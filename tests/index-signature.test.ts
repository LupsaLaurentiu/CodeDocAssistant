import { expect, it } from "vitest";
import { canReuseIndex, indexSignature } from "@/lib/ingestion/index-signature";
it("reuses only a populated, matching commit and complete index configuration", () => {
  const signature = indexSignature("embedding-model", 1536);
  const old = {
    indexedAt: new Date(),
    indexedCommitSha: "abc",
    indexSignature: signature,
  };
  expect(canReuseIndex(old, "abc", signature, 2)).toBe(true);
  expect(canReuseIndex(old, "new", signature, 2)).toBe(false);
  expect(
    canReuseIndex(old, "abc", indexSignature("other-model", 1536), 2),
  ).toBe(false);
  expect(
    canReuseIndex(old, "abc", indexSignature("embedding-model", 512), 2),
  ).toBe(false);
  expect(canReuseIndex(old, "abc", signature, 0)).toBe(false);
  expect(canReuseIndex({ ...old, indexedAt: null }, "abc", signature, 2)).toBe(
    false,
  );
});
