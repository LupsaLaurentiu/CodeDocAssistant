import { Prisma, type RepositoryStatus } from "@prisma/client";

import { db } from "@/lib/db/client";
import type { SourceChunk } from "@/types/rag";

interface EmbeddedChunk {
  chunk: SourceChunk;
  embedding: number[];
}

const INSERT_BATCH_SIZE = 100;

export async function replaceCodeChunks(
  repositoryId: string,
  chunks: EmbeddedChunk[],
): Promise<void> {
  await db.$transaction(
    async (transaction) => {
      await transaction.codeChunk.deleteMany({ where: { repositoryId } });

      for (
        let offset = 0;
        offset < chunks.length;
        offset += INSERT_BATCH_SIZE
      ) {
        const batch = chunks.slice(offset, offset + INSERT_BATCH_SIZE);
        const rows = batch.map(
          ({ chunk, embedding }) =>
            Prisma.sql`(
            ${repositoryId}::uuid,
            ${chunk.filePath},
            ${chunk.language},
            ${chunk.startLine},
            ${chunk.endLine},
            ${chunk.symbol ?? null},
            ${chunk.content},
            ${JSON.stringify(embedding)}::vector
          )`,
        );

        await transaction.$executeRaw(Prisma.sql`
          INSERT INTO "code_chunks" (
            "repository_id",
            "file_path",
            "language",
            "start_line",
            "end_line",
            "symbol",
            "content",
            "embedding"
          )
          VALUES ${Prisma.join(rows)}
        `);
      }

      await transaction.repository.update({
        where: { id: repositoryId },
        data: {
          status: "READY" satisfies RepositoryStatus,
          errorMessage: null,
        },
      });
    },
    { timeout: 120_000 },
  );
}
