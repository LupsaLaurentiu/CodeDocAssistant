import { z } from "zod";
import type { ConversationMessage } from "@/types/rag";
import { QUESTION_LIMITS } from "@/lib/api/question-schema";

const sourceSchema = z
  .object({
    chunkId: z.string().uuid(),
    filePath: z.string().min(1).max(1_024),
    startLine: z.number().int().positive(),
    endLine: z.number().int().positive(),
  })
  .refine((source) => source.endLine >= source.startLine);

export const answerSchema = z.object({
  answer: z.string().min(1).max(64_000),
  citations: z.array(sourceSchema).max(32),
  consultedSources: z.array(sourceSchema).max(32),
  retrievedChunks: z.number().int().nonnegative(),
  grounding: z.enum(["verified", "insufficient", "unverified"]),
  warning: z.string().max(2_000).optional(),
});

const historyMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(QUESTION_LIMITS.message),
});

const turnSchema = z
  .object({
    id: z.string().uuid(),
    question: z.string().min(2).max(QUESTION_LIMITS.question),
    history: z.array(historyMessageSchema).max(QUESTION_LIMITS.history),
    status: z.enum(["pending", "answered", "failed"]),
    answer: answerSchema.optional(),
    error: z.string().max(2_000).optional(),
  })
  .refine((turn) => turn.status !== "answered" || Boolean(turn.answer));

export type ChatTurn = z.infer<typeof turnSchema>;
export const MAX_SAVED_TURNS = 30;
export const MAX_STORAGE_CHARACTERS = 500_000;
const STORAGE_VERSION = 2;
const savedConversationSchema = z.object({
  version: z.literal(STORAGE_VERSION),
  indexRevision: z.string().max(160),
  turns: z.array(turnSchema).max(MAX_SAVED_TURNS),
});

export function conversationKey(repositoryId: string) {
  return `codedoc:conversation:${repositoryId}`;
}

export function buildConversationHistory(
  turns: ChatTurn[],
): ConversationMessage[] {
  return turns
    .filter((turn) => turn.status === "answered" && turn.answer)
    .flatMap((turn): ConversationMessage[] => [
      { role: "user", content: turn.question },
      {
        role: "assistant",
        content: turn.answer!.answer.slice(0, QUESTION_LIMITS.message),
      },
    ])
    .slice(-QUESTION_LIMITS.history);
}

export function serializeConversation(
  turns: ChatTurn[],
  indexRevision: string,
) {
  const savedTurns = turns.slice(-MAX_SAVED_TURNS);
  let encoded = JSON.stringify({
    version: STORAGE_VERSION,
    indexRevision,
    turns: savedTurns,
  });
  while (encoded.length > MAX_STORAGE_CHARACTERS && savedTurns.length > 0) {
    savedTurns.shift();
    encoded = JSON.stringify({
      version: STORAGE_VERSION,
      indexRevision,
      turns: savedTurns,
    });
  }
  return encoded;
}

export function restoreConversation(
  raw: string | null,
  indexRevision: string,
): {
  turns: ChatTurn[];
  notice?: string;
} {
  if (!raw) return { turns: [] };
  if (raw.length > MAX_STORAGE_CHARACTERS) {
    return {
      turns: [],
      notice:
        "Saved history was too large to restore. A new conversation is ready.",
    };
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return {
      turns: [],
      notice: "Saved history could not be read. A new conversation is ready.",
    };
  }
  const parsed = savedConversationSchema.safeParse(value);
  if (!parsed.success) {
    return {
      turns: [],
      notice:
        "Saved history uses an older or invalid format. A new conversation is ready.",
    };
  }
  if (parsed.data.indexRevision !== indexRevision) {
    return {
      turns: [],
      notice:
        "This repository was reindexed. A new conversation avoids using outdated answers and source links.",
    };
  }
  const interrupted = parsed.data.turns.some(
    (turn) => turn.status === "pending",
  );
  return {
    turns: parsed.data.turns.map((turn) =>
      turn.status === "pending"
        ? {
            ...turn,
            status: "failed",
            error: "The request was interrupted. Retry to ask again.",
          }
        : turn,
    ),
    notice: interrupted
      ? "An unfinished request was restored. Retrying may make a new billable API call."
      : undefined,
  };
}
