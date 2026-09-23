import { beforeEach, describe, expect, it, vi } from "vitest";
import { indexSignature } from "@/lib/ingestion/index-signature";
const mocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  mkdtemp: vi.fn(),
  rm: vi.fn(),
  stat: vi.fn(),
  readFile: vi.fn(),
  clone: vi.fn(),
  scan: vi.fn(),
  embed: vi.fn(),
  replace: vi.fn(),
  acquire: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
  files: vi.fn(),
  revparse: vi.fn(),
}));
vi.mock("node:fs/promises", () => ({
  mkdir: mocks.mkdir,
  mkdtemp: mocks.mkdtemp,
  rm: mocks.rm,
  stat: mocks.stat,
  readFile: mocks.readFile,
}));
vi.mock("simple-git", () => ({
  simpleGit: () => ({ revparse: mocks.revparse }),
}));
vi.mock("@/config/env", () => ({
  getEnvironment: () => ({ REPOSITORY_STORAGE_PATH: ".data/mock-test" }),
}));
vi.mock("@/config/ai", () => ({
  getAiConfig: () => ({ embeddingModel: "test", embeddingDimensions: 3 }),
}));
vi.mock("@/lib/db", () => ({
  db: {
    repository: { updateMany: mocks.update },
    codeChunk: { count: mocks.count, findMany: mocks.files },
  },
  replaceCodeChunks: mocks.replace,
}));
vi.mock("@/lib/github", () => ({ cloneRepository: mocks.clone }));
vi.mock("@/lib/rag/embeddings", () => ({ createEmbeddings: mocks.embed }));
vi.mock("@/lib/ingestion/scan-repository-files", () => ({
  scanRepositoryFiles: mocks.scan,
}));
vi.mock("@/lib/ingestion/lease", () => ({
  acquireAnalysisLease: mocks.acquire,
  leaseDeadline: () => new Date(Date.now() + 300_000),
  ownedLease: (id: string, token: string) => ({ id, analysisToken: token }),
  leaseLostError: () => new Error("Lease lost"),
}));
import { analyzeRepository } from "@/lib/ingestion/analyze-repository";
const reference = {
  owner: "test",
  name: "repo",
  url: "https://github.com/test/repo",
  cloneUrl: "https://github.com/test/repo.git",
};
beforeEach(() => {
  mocks.mkdir.mockResolvedValue(undefined);
  mocks.mkdtemp.mockImplementation(async (prefix: string) => prefix + "test");
  mocks.rm.mockResolvedValue(undefined);
  mocks.stat.mockResolvedValue({ size: 5 });
  mocks.readFile.mockResolvedValue("hello");
  mocks.clone.mockResolvedValue("clone");
  mocks.revparse.mockImplementation(async (args: string[]) =>
    args[0] === "HEAD" ? "commit" : "main",
  );
  mocks.update.mockResolvedValue({ count: 1 });
  mocks.count.mockResolvedValue(1);
  mocks.files.mockResolvedValue([{ filePath: "a.ts" }]);
  mocks.scan.mockResolvedValue([
    { absolutePath: "mock/a.ts", relativePath: "a.ts", language: "typescript" },
  ]);
  mocks.embed.mockResolvedValue([[1, 0, 0]]);
  mocks.replace.mockResolvedValue(undefined);
  mocks.acquire.mockResolvedValue({
    token: "lease",
    repository: {
      id: "repo-id",
      url: reference.url,
      indexedAt: new Date(),
      indexedCommitSha: "commit",
      indexSignature: indexSignature("test", 3),
    },
  });
});
describe("ingestion recovery and reuse without provider calls", () => {
  it("reuses a matching index and does not scan/embed/replace", async () => {
    const result = await analyzeRepository(reference);
    expect(result.indexReused).toBe(true);
    expect(mocks.embed).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.scan).not.toHaveBeenCalled();
    expect(mocks.rm).toHaveBeenCalled();
  });
  it("embeds a changed commit then atomically publishes it", async () => {
    mocks.revparse.mockImplementation(async (args: string[]) =>
      args[0] === "HEAD" ? "changed" : "main",
    );
    const result = await analyzeRepository(reference);
    expect(result.indexReused).toBe(false);
    expect(mocks.embed).toHaveBeenCalledOnce();
    expect(mocks.replace).toHaveBeenCalledWith(
      "repo-id",
      expect.any(Array),
      expect.objectContaining({ token: "lease", commitSha: "changed" }),
    );
  });
  it("preserves previous usable state on failed reindex without replacing chunks", async () => {
    mocks.clone.mockRejectedValue(new Error("Raw secret error"));
    await expect(analyzeRepository(reference)).rejects.toThrow(
      "Could not clone",
    );
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "READY",
          analysisPhase: "FAILED",
        }),
      }),
    );
  });
  it("handles temporary-directory initialization failures inside the error boundary", async () => {
    mocks.mkdir.mockRejectedValue(new Error("Disk unavailable"));
    await expect(analyzeRepository(reference)).rejects.toThrow(
      "Disk unavailable",
    );
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ analysisPhase: "FAILED" }),
      }),
    );
    expect(mocks.rm).not.toHaveBeenCalled();
  });
  it("does not hide a successful index or original error when cleanup fails", async () => {
    mocks.rm.mockRejectedValue(new Error("Cleanup permission denied"));
    expect((await analyzeRepository(reference)).indexReused).toBe(true);
  });
});
