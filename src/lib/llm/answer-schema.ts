import { z } from "zod";
import type { RetrievedChunk } from "@/types/rag";

export const generatedAnswerSchema = z.object({
  status: z.enum(["answered", "insufficient_context"]),
  sections: z.array(
    z.object({
      text: z.string(),
      citations: z.array(
        z.object({
          sourceId: z.string(),
          startLine: z.number().int(),
          endLine: z.number().int(),
        }),
      ),
    }),
  ),
});
export type GeneratedAnswer = z.infer<typeof generatedAnswerSchema>;

/** Constrain generation to the exact source IDs and visible ranges in this request. */
export function createAnswerSchema(chunks: RetrievedChunk[]) {
  if (!chunks.length)
    throw new Error("Answer generation requires source context.");
  const references = chunks.map((chunk, index) =>
    z.object({
      sourceId: z.literal(`S${index + 1}`),
      startLine: z.number().int().min(chunk.startLine).max(chunk.endLine),
      endLine: z.number().int().min(chunk.startLine).max(chunk.endLine),
    }),
  );
  const citation =
    references.length === 1 ? references[0] : z.union(references);
  return generatedAnswerSchema.extend({
    sections: z
      .array(
        z.object({
          // Keep prose-length checks server-side; the provider schema uses only
          // documented numeric, array and per-source constraints.
          text: z.string(),
          citations: z.array(citation).min(1).max(12),
        }),
      )
      .max(12),
  });
}
