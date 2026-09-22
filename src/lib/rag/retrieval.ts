import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import type { RetrievedChunk } from "@/types/rag";

export interface Retriever {
  search(input: {
    repositoryId: string;
    queryEmbedding: number[];
    limit: number;
  }): Promise<RetrievedChunk[]>;
}

interface RetrievedChunkRow {
  id: string;
  filePath: string;
  language: string;
  startLine: number;
  endLine: number;
  symbol: string | null;
  content: string;
  score: number;
}

export async function retrieveRelevantChunks(input: {
  repositoryId: string;
  queryEmbedding: number[];
  limit?: number;
}): Promise<RetrievedChunk[]> {
  const limit = input.limit ?? 8;
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new Error("Retrieval limit must be an integer between 1 and 20.");
  }

  const vector = JSON.stringify(input.queryEmbedding);
  const rows = await db.$queryRaw<RetrievedChunkRow[]>(Prisma.sql`
    SELECT
      "id",
      "file_path" AS "filePath",
      "language",
      "start_line" AS "startLine",
      "end_line" AS "endLine",
      "symbol",
      "content",
      (1 - ("embedding" <=> ${vector}::vector))::double precision AS "score"
    FROM "code_chunks"
    WHERE
      "repository_id" = ${input.repositoryId}::uuid
      AND "embedding" IS NOT NULL
    ORDER BY "embedding" <=> ${vector}::vector
    LIMIT ${limit}
  `);

  return rows.map((row) => ({
    id: row.id,
    filePath: row.filePath,
    language: row.language,
    startLine: row.startLine,
    endLine: row.endLine,
    symbol: row.symbol ?? undefined,
    content: row.content,
    score: Math.max(0, Math.min(1, row.score)),
  }));
}
