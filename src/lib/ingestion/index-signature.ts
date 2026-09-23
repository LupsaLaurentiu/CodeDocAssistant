import { createHash } from "node:crypto";
import {
  IGNORED_GLOBS,
  INGESTION_LIMITS,
  SUPPORTED_EXTENSIONS,
} from "./constants";

/** Bump pipelineVersion whenever scanning, normalization or chunk semantics change. */
export function indexSignature(model: string, dimensions: number): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        pipelineVersion: 2,
        model,
        dimensions,
        limits: INGESTION_LIMITS,
        supported: SUPPORTED_EXTENSIONS,
        ignored: IGNORED_GLOBS,
        maxLines: 120,
        overlapLines: 20,
      }),
    )
    .digest("hex");
}

export function canReuseIndex(
  previous: {
    indexedCommitSha: string | null;
    indexSignature: string | null;
    indexedAt: Date | null;
  },
  commitSha: string,
  signature: string,
  chunkCount: number,
): boolean {
  return Boolean(
    previous.indexedAt &&
    previous.indexedCommitSha === commitSha &&
    previous.indexSignature === signature &&
    chunkCount > 0,
  );
}
