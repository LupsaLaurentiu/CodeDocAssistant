import { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import { z } from "zod";

import { RepositoryWorkspace } from "@/components/repository-workspace";
import { db } from "@/lib/db";
import type { RepositoryWorkspaceData } from "@/types/repository";
import { effectiveRepositoryStatus } from "@/lib/ingestion/effective-status";

export const dynamic = "force-dynamic";

interface FileCountRow {
  count: bigint;
}

export default async function RepositoryPage({
  params,
}: {
  params: Promise<{ repositoryId: string }>;
}) {
  const { repositoryId } = await params;
  if (!z.string().uuid().safeParse(repositoryId).success) {
    notFound();
  }

  const repository = await db.repository.findUnique({
    where: { id: repositoryId },
    include: { _count: { select: { chunks: true } } },
  });
  if (!repository) {
    notFound();
  }

  const [fileCounts, languageRows] = await Promise.all([
    db.$queryRaw<FileCountRow[]>(Prisma.sql`
      SELECT COUNT(DISTINCT "file_path")::bigint AS "count"
      FROM "code_chunks"
      WHERE "repository_id" = ${repositoryId}::uuid
    `),
    db.codeChunk.findMany({
      where: { repositoryId },
      select: { language: true },
      distinct: ["language"],
      orderBy: { language: "asc" },
    }),
  ]);

  const data: RepositoryWorkspaceData = {
    id: repository.id,
    url: repository.url,
    owner: repository.owner,
    name: repository.name,
    defaultBranch: repository.defaultBranch ?? undefined,
    status: effectiveRepositoryStatus(repository),
    fileCount: Number(fileCounts[0]?.count ?? 0),
    chunkCount: repository._count.chunks,
    languages: languageRows.map((row) => row.language),
    indexedAt: (repository.indexedAt ?? repository.updatedAt).toISOString(),
    indexedCommitSha: repository.indexedCommitSha ?? undefined,
  };

  return <RepositoryWorkspace repository={data} />;
}
