import type { RepositoryStatus } from "@prisma/client";

/** A dead worker must not hide the last successfully committed index. */
export function effectiveRepositoryStatus(repository: {
  status: RepositoryStatus;
  indexedAt: Date | null;
  leaseExpiresAt: Date | null;
}): RepositoryStatus {
  if (
    ["CLONING", "INDEXING"].includes(repository.status) &&
    repository.leaseExpiresAt &&
    repository.leaseExpiresAt <= new Date()
  ) {
    return repository.indexedAt ? "READY" : "FAILED";
  }
  return repository.status;
}
