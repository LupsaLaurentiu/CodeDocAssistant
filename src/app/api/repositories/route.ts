import { db } from "@/lib/db";
import { errorResponse } from "@/lib/api/errors";
import { effectiveRepositoryStatus } from "@/lib/ingestion/effective-status";

export const runtime = "nodejs";
export async function GET(): Promise<Response> {
  try {
    const repositories = await db.repository.findMany({
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: {
        id: true,
        url: true,
        owner: true,
        name: true,
        status: true,
        indexedAt: true,
        indexedCommitSha: true,
        analysisPhase: true,
        leaseExpiresAt: true,
        _count: { select: { chunks: true } },
      },
    });
    return Response.json(
      {
        result: repositories.map((repository) => ({
          id: repository.id,
          url: repository.url,
          owner: repository.owner,
          name: repository.name,
          status: effectiveRepositoryStatus(repository),
          indexedAt: repository.indexedAt?.toISOString() ?? null,
          commitSha: repository.indexedCommitSha,
          chunkCount: repository._count.chunks,
          phase: repository.analysisPhase,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(
      error,
      "Recent repositories are unavailable. Check that PostgreSQL is running.",
    );
  }
}
