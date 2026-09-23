import { z } from "zod";

export const QUESTION_LIMITS = {
  question: 2_000,
  history: 6,
  message: 8_000,
} as const;
export const questionRequestSchema = z.object({
  question: z.string().trim().min(2).max(QUESTION_LIMITS.question),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(QUESTION_LIMITS.message),
      }),
    )
    .max(QUESTION_LIMITS.history)
    .default([]),
});
