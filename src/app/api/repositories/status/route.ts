import { db } from "@/lib/db";
import { validateRepositoryUrl } from "@/lib/github";
import { errorResponse } from "@/lib/api/errors";

export const runtime = "nodejs";
export async function GET(request: Request): Promise<Response> {
  let url: string;
  try {
    url = validateRepositoryUrl(
      new URL(request.url).searchParams.get("url") ?? "",
    ).url;
  } catch {
    return Response.json(
      { error: "A valid public GitHub URL is required." },
      { status: 400 },
    );
  }
  try {
    const repository = await db.repository.findFirst({
      where: { url: { equals: url, mode: "insensitive" } },
      select: {
        id: true,
        status: true,
        analysisPhase: true,
        filesDiscovered: true,
        filesProcessed: true,
        filesSkipped: true,
        chunksTotal: true,
        chunksEmbedded: true,
        errorMessage: true,
        indexedCommitSha: true,
        indexReused: true,
        updatedAt: true,
        leaseExpiresAt: true,
        indexedAt: true,
      },
    });
    if (!repository)
      return Response.json(
        { error: "Repository not found." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    const expired =
      repository.leaseExpiresAt &&
      repository.leaseExpiresAt <= new Date() &&
      !["COMPLETE", "FAILED"].includes(repository.analysisPhase);
    return Response.json(
      {
        result: {
          repositoryId: repository.id,
          status: expired
            ? repository.indexedAt
              ? "READY"
              : "FAILED"
            : repository.status,
          phase: expired ? "FAILED" : repository.analysisPhase,
          filesDiscovered: repository.filesDiscovered,
          filesProcessed: repository.filesProcessed,
          filesSkipped: repository.filesSkipped,
          chunksTotal: repository.chunksTotal,
          chunksEmbedded: repository.chunksEmbedded,
          error: expired
            ? "Analysis stopped before completion. Retry to start again."
            : repository.errorMessage,
          commitSha: repository.indexedCommitSha,
          indexReused: repository.indexReused,
          updatedAt: repository.updatedAt.toISOString(),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(
      error,
      "Cannot read analysis progress. Check PostgreSQL and retry.",
    );
  }
}
