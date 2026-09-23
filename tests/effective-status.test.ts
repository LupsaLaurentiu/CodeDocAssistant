import { expect, it } from "vitest";
import { effectiveRepositoryStatus } from "@/lib/ingestion/effective-status";
it("keeps a previously successful index available after a worker dies", () => {
  expect(
    effectiveRepositoryStatus({
      status: "INDEXING",
      indexedAt: new Date(),
      leaseExpiresAt: new Date(Date.now() - 1),
    }),
  ).toBe("READY");
  expect(
    effectiveRepositoryStatus({
      status: "INDEXING",
      indexedAt: null,
      leaseExpiresAt: new Date(Date.now() - 1),
    }),
  ).toBe("FAILED");
  expect(
    effectiveRepositoryStatus({
      status: "INDEXING",
      indexedAt: new Date(),
      leaseExpiresAt: new Date(Date.now() + 60_000),
    }),
  ).toBe("INDEXING");
});
