import { beforeEach, expect, it, vi } from "vitest";
const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/config/ai", () => ({
  getAiConfig: () => ({ embeddingModel: "test", embeddingDimensions: 3 }),
}));
vi.mock("@/lib/llm/client", () => ({
  getOpenAiClient: () => ({ embeddings: { create } }),
}));
import { createEmbeddings } from "@/lib/rag/embeddings";
beforeEach(() => {
  create.mockImplementation(async ({ input }: { input: string[] }) => ({
    data: input.map((_, index) => ({ index, embedding: [0, 1, 0] })).reverse(),
    usage: { total_tokens: input.length },
  }));
});
it("orders batches, reports real progress/tokens, and bounds batch size", async () => {
  const onBatch = vi.fn(async () => {});
  expect(
    await createEmbeddings(Array(33).fill("source"), { onBatch }),
  ).toHaveLength(33);
  expect(create).toHaveBeenCalledTimes(2);
  expect(onBatch).toHaveBeenNthCalledWith(1, {
    completed: 32,
    total: 33,
    tokens: 32,
  });
  expect(onBatch).toHaveBeenNthCalledWith(2, {
    completed: 33,
    total: 33,
    tokens: 1,
  });
});
it("rejects non-finite vectors", async () => {
  create.mockResolvedValue({ data: [{ index: 0, embedding: [NaN, 1, 0] }] });
  await expect(createEmbeddings(["source"])).rejects.toThrow(
    "Invalid embedding",
  );
});
it("makes no API request for empty input", async () => {
  expect(await createEmbeddings([])).toEqual([]);
  expect(create).not.toHaveBeenCalled();
});
