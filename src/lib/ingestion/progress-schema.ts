import { z } from "zod";
export const progressSchema = z.object({
  repositoryId: z.string().uuid(),
  status: z.enum(["PENDING", "CLONING", "INDEXING", "READY", "FAILED"]),
  phase: z.enum([
    "IDLE",
    "CLONING",
    "SCANNING",
    "CHUNKING",
    "EMBEDDING",
    "SAVING",
    "COMPLETE",
    "FAILED",
  ]),
  filesDiscovered: z.number().int().nonnegative(),
  filesProcessed: z.number().int().nonnegative(),
  filesSkipped: z.number().int().nonnegative(),
  chunksTotal: z.number().int().nonnegative(),
  chunksEmbedded: z.number().int().nonnegative(),
  error: z.string().nullable(),
  commitSha: z.string().nullable(),
  indexReused: z.boolean(),
  updatedAt: z.string(),
});
export const analysisResultSchema = z.object({
  repositoryId: z.string().uuid(),
  repositoryUrl: z.string().url(),
  filesDiscovered: z.number().int().nonnegative(),
  filesIndexed: z.number().int().nonnegative(),
  filesSkipped: z.number().int().nonnegative(),
  chunksIndexed: z.number().int().nonnegative(),
  commitSha: z.string().optional(),
  indexReused: z.boolean().optional(),
});
