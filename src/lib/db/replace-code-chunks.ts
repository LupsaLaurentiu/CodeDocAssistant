import { Prisma, type RepositoryStatus } from "@prisma/client";

import { db } from "@/lib/db/client";
import type { SourceChunk } from "@/types/rag";
import { leaseLostError, ownedLease } from "@/lib/ingestion/lease";

interface EmbeddedChunk {
  chunk: SourceChunk;
  embedding: number[];
}

const INSERT_BATCH_SIZE = 100;

export async function replaceCodeChunks(
  repositoryId: string,
  chunks: EmbeddedChunk[],
  index: {
    token: string;
    commitSha: string;
    signature: string;
    defaultBranch: string;
  },
): Promise<void> {
  await db.$transaction(
    async (transaction) => {
      // Lock the repository row and fence stale workers BEFORE replacing chunks.
      const owned = await transaction.repository.updateMany({
        where: ownedLease(repositoryId, index.token),
        data: { analysisPhase: "SAVING" },
      });
      if (owned.count !== 1) throw leaseLostError();
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
          analysisPhase: "COMPLETE",
          indexedCommitSha: index.commitSha,
          indexSignature: index.signature,
          defaultBranch: index.defaultBranch,
          indexedAt: new Date(),
        },
      });
    },
    { timeout: 120_000 },
  );
}
