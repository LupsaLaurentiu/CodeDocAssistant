import { z } from "zod";

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
