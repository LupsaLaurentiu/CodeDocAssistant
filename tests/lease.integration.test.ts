import { afterAll, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db/client", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return {
    db: new PrismaClient({
      datasourceUrl:
        process.env.TEST_DATABASE_URL ??
        "postgresql://test:test@127.0.0.1:1/test",
    }),
  };
});
import { db } from "@/lib/db/client";
import { acquireAnalysisLease } from "@/lib/ingestion/lease";
import { replaceCodeChunks } from "@/lib/db/replace-code-chunks";
const createdIds: string[] = [];
afterAll(async () => {
  for (const id of createdIds) await db.repository.delete({ where: { id } });
  await db.$disconnect();
});
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "PostgreSQL leases and transaction fencing (isolated test database)",
  () => {
    it("allows exactly one concurrent owner, recovers expiry and rejects a stale writer", async () => {
      const name = "lease-test-" + crypto.randomUUID();
      const reference = {
        owner: "codedoc-tests",
        name,
        url: `https://github.com/codedoc-tests/${name}`,
        cloneUrl: `https://github.com/codedoc-tests/${name}.git`,
      };
      const attempts = await Promise.allSettled([
        acquireAnalysisLease(reference),
        acquireAnalysisLease(reference),
      ]);
      expect(
        attempts.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      const winner = attempts.find((result) => result.status === "fulfilled");
      if (!winner || winner.status !== "fulfilled")
        throw new Error("Expected a lease winner");
      const { repository, token } = winner.value;
      createdIds.push(repository.id);
      await db.repository.update({
        where: { id: repository.id },
        data: { leaseExpiresAt: new Date(Date.now() - 1000) },
      });
      const replacement = await acquireAnalysisLease({
        ...reference,
        url: reference.url.toUpperCase(),
      });
      expect(replacement.repository.id).toBe(repository.id);
      expect(replacement.token).not.toBe(token);
      await expect(
        replaceCodeChunks(repository.id, [], {
          token,
          commitSha: "bad",
          signature: "bad",
          defaultBranch: "main",
        }),
      ).rejects.toThrow("lease");
      const current = await db.repository.findUniqueOrThrow({
        where: { id: repository.id },
      });
      expect(current.analysisToken).toBe(replacement.token);
      expect(current.indexedCommitSha).toBeNull();
    });
  },
);
