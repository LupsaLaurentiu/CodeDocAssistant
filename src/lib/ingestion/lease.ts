import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { ApiError } from "@/lib/api/errors";
import type { GitHubRepositoryReference } from "@/types/repository";

export const LEASE_DURATION_MS = 5 * 60_000;
export const leaseDeadline = () => new Date(Date.now() + LEASE_DURATION_MS);
export const leaseLostError = () =>
  new ApiError(
    "The analysis lease expired. Retry the analysis.",
    409,
    "ANALYSIS_LEASE_LOST",
  );

export async function acquireAnalysisLease(
  reference: GitHubRepositoryReference,
) {
  const where = {
    url: { equals: reference.url, mode: "insensitive" as const },
  };
  let repository = await db.repository.findFirst({ where });
  if (!repository) {
    try {
      repository = await db.repository.create({
        data: {
          url: reference.url,
          owner: reference.owner,
          name: reference.name,
        },
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      )
        throw error;
      repository = await db.repository.findFirst({ where });
      if (!repository) throw error;
    }
  }
  const token = crypto.randomUUID();
  const acquired = await db.repository.updateMany({
    where: {
      id: repository.id,
      OR: [{ analysisToken: null }, { leaseExpiresAt: { lte: new Date() } }],
    },
    data: {
      analysisToken: token,
      leaseExpiresAt: leaseDeadline(),
      status: "CLONING",
      analysisPhase: "CLONING",
      errorMessage: null,
      filesDiscovered: 0,
      filesProcessed: 0,
      filesSkipped: 0,
      chunksTotal: 0,
      chunksEmbedded: 0,
      indexReused: false,
    },
  });
  if (acquired.count !== 1)
    throw new ApiError(
      "This repository is already being analyzed. Wait for it to finish, or retry after its five-minute lease expires.",
      409,
      "ANALYSIS_IN_PROGRESS",
    );
  // Refresh metadata after the claim: a previous worker may have committed while we waited.
  const locked = await db.repository.findUniqueOrThrow({
    where: { id: repository.id },
  });
  return { repository: locked, token };
}

export function ownedLease(repositoryId: string, token: string) {
  return {
    id: repositoryId,
    analysisToken: token,
    leaseExpiresAt: { gt: new Date() },
  };
}
