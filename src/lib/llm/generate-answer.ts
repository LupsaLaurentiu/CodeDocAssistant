import { zodTextFormat } from "openai/helpers/zod";
import { getAiConfig } from "@/config/ai";
import { ApiError } from "@/lib/api/errors";
import { logEvent } from "@/lib/observability";
import type { ConversationMessage, RetrievedChunk } from "@/types/rag";
import { buildRagContext } from "../rag/context";
import { createAnswerSchema, type GeneratedAnswer } from "./answer-schema";
import { getOpenAiClient } from "./client";
import { CODE_ASSISTANT_SYSTEM_PROMPT } from "./prompts";

export async function generateAnswer(
  question: string,
  chunks: RetrievedChunk[],
  history: ConversationMessage[] = [],
): Promise<GeneratedAnswer> {
  const started = performance.now();
  const model = getAiConfig().chatModel;
  const response = await getOpenAiClient().responses.parse({
    model,
    instructions: CODE_ASSISTANT_SYSTEM_PROMPT,
    input: JSON.stringify({
      conversation_history: history,
      repository_context: buildRagContext(chunks),
      current_question: question,
    }),
    text: {
      format: zodTextFormat(createAnswerSchema(chunks), "repository_answer"),
    },
    max_output_tokens: 2_500,
    store: false,
  });
  logEvent("llm.answer", {
    model,
    durationMs: Math.round(performance.now() - started),
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
    status: response.status,
  });
  if (response.status !== "completed")
    throw new ApiError(
      "The answer was interrupted before completion. Try a narrower question.",
      502,
      "ANSWER_INCOMPLETE",
    );
  if (!response.output_parsed)
    throw new ApiError(
      "The AI provider could not produce a supported answer to this question. Try rephrasing it.",
      422,
      "ANSWER_UNAVAILABLE",
    );
  return response.output_parsed;
}
