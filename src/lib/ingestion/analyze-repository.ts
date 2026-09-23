import { mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { simpleGit } from "simple-git";
import type { Prisma } from "@prisma/client";
import { getEnvironment } from "@/config/env";
import { getAiConfig } from "@/config/ai";
import { db, replaceCodeChunks } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";
import { logEvent } from "@/lib/observability";
import { cloneRepository } from "@/lib/github";
import { createEmbeddings } from "@/lib/rag/embeddings";
import type { SourceChunk } from "@/types/rag";
import type {
  GitHubRepositoryReference,
  RepositoryAnalysisResult,
  RepositoryAnalysisPhase,
} from "@/types/repository";
import { chunkSourceFile } from "./chunk-source-file";
import { INGESTION_LIMITS } from "./constants";
import { scanRepositoryFiles } from "./scan-repository-files";
import {
  acquireAnalysisLease,
  leaseDeadline,
  leaseLostError,
  ownedLease,
} from "./lease";
import { canReuseIndex, indexSignature } from "./index-signature";

function buildEmbeddingInput(chunk: SourceChunk): string {
  return [
    `File: ${chunk.filePath}`,
    `Language: ${chunk.language}`,
    `Lines: ${chunk.startLine}-${chunk.endLine}`,
    chunk.content,
  ].join("\n");
}

export async function analyzeRepository(
  reference: GitHubRepositoryReference,
): Promise<RepositoryAnalysisResult> {
  const { repository, token } = await acquireAnalysisLease(reference);
  const started = performance.now();
  let stageStarted = started;
  let phase: RepositoryAnalysisPhase = "CLONING";
  let clonePath: string | undefined;
  let storageRoot: string | undefined;
  let leaseLost = false;
  let heartbeatPending: Promise<void> | undefined;
  const heartbeat = setInterval(() => {
    if (heartbeatPending) return;
    heartbeatPending = db.repository
      .updateMany({
        where: ownedLease(repository.id, token),
        data: { leaseExpiresAt: leaseDeadline() },
      })
      .then((result) => {
        if (result.count !== 1) leaseLost = true;
      })
      .catch(() => {
        leaseLost = true;
      })
      .finally(() => {
        heartbeatPending = undefined;
      });
  }, 20_000);
  heartbeat.unref();

  async function progress(
    nextPhase: RepositoryAnalysisPhase,
    data: Prisma.RepositoryUpdateManyMutationInput = {},
  ) {
    if (leaseLost) throw leaseLostError();
    if (phase !== nextPhase) {
      logEvent("ingestion.stage", {
        repositoryId: repository.id,
        phase,
        durationMs: Math.round(performance.now() - stageStarted),
      });
      phase = nextPhase;
      stageStarted = performance.now();
    }
    const updated = await db.repository.updateMany({
      where: ownedLease(repository.id, token),
      data: {
        ...data,
        analysisPhase: nextPhase,
        leaseExpiresAt: leaseDeadline(),
      },
    });
    if (updated.count !== 1) throw leaseLostError();
  }

  try {
    storageRoot = path.resolve(
      /* turbopackIgnore: true */ process.cwd(),
      getEnvironment().REPOSITORY_STORAGE_PATH,
    );
    await mkdir(storageRoot, { recursive: true });
    clonePath = await mkdtemp(path.join(storageRoot, "codedoc-"));
    try {
      await cloneRepository(reference, clonePath);
    } catch {
      throw new ApiError(
        "Could not clone this public GitHub repository. Check its URL, visibility and your network connection.",
        422,
        "CLONE_FAILED",
      );
    }
    const git = simpleGit(clonePath);
    const [rawCommit, rawBranch] = await Promise.all([
      git.revparse(["HEAD"]),
      git.revparse(["--abbrev-ref", "HEAD"]),
    ]);
    const commitSha = rawCommit.trim();
    const defaultBranch = rawBranch.trim();
    const config = getAiConfig();
    const signature = indexSignature(
      config.embeddingModel,
      config.embeddingDimensions,
    );
    const chunkCount = await db.codeChunk.count({
      where: { repositoryId: repository.id },
    });

    if (canReuseIndex(repository, commitSha, signature, chunkCount)) {
      const files = await db.codeChunk.findMany({
        where: { repositoryId: repository.id },
        distinct: ["filePath"],
        select: { filePath: true },
      });
      await progress("COMPLETE", {
        status: "READY",
        defaultBranch,
        filesDiscovered: files.length,
        filesProcessed: files.length,
        chunksTotal: chunkCount,
        chunksEmbedded: chunkCount,
        indexReused: true,
      });
      logEvent("ingestion.complete", {
        repositoryId: repository.id,
        indexReused: true,
        durationMs: Math.round(performance.now() - started),
        embeddingTokens: 0,
      });
      return {
        repositoryId: repository.id,
        repositoryUrl: repository.url,
        filesDiscovered: files.length,
        filesIndexed: files.length,
        filesSkipped: 0,
        chunksIndexed: chunkCount,
        indexReused: true,
        commitSha,
      };
    }

    await progress("SCANNING", { status: "INDEXING" });
    const files = await scanRepositoryFiles(clonePath);
    if (files.length > INGESTION_LIMITS.maxFiles)
      throw new ApiError(
        `Repository exceeds the ${INGESTION_LIMITS.maxFiles} supported-file limit.`,
        422,
        "REPOSITORY_TOO_LARGE",
      );
    await progress("CHUNKING", { filesDiscovered: files.length });
    const chunks: SourceChunk[] = [];
    let indexedBytes = 0;
    let filesIndexed = 0;
    let filesSkipped = 0;
    for (const [index, file] of files.entries()) {
      const fileStats = await stat(file.absolutePath);
      if (
        fileStats.size === 0 ||
        fileStats.size > INGESTION_LIMITS.maxFileBytes
      ) {
        filesSkipped++;
      } else {
        indexedBytes += fileStats.size;
        if (indexedBytes > INGESTION_LIMITS.maxRepositoryBytes)
          throw new ApiError(
            "Supported source files exceed the 25 MB ingestion limit.",
            422,
            "REPOSITORY_TOO_LARGE",
          );
        const content = await readFile(file.absolutePath, "utf8");
        if (!content.trim() || content.includes("\u0000")) {
          filesSkipped++;
        } else {
          chunks.push(
            ...chunkSourceFile({
              filePath: file.relativePath,
              language: file.language,
              content,
              maxCharacters: INGESTION_LIMITS.maxChunkCharacters,
            }),
          );
          if (chunks.length > INGESTION_LIMITS.maxChunks)
            throw new ApiError(
              "Repository exceeds the 5,000-chunk cost-control limit. Analyze a smaller repository.",
              422,
              "TOO_MANY_CHUNKS",
            );
          filesIndexed++;
        }
      }
      if (index % 20 === 0 || index === files.length - 1)
        await progress("CHUNKING", {
          filesProcessed: index + 1,
          filesSkipped,
          chunksTotal: chunks.length,
        });
    }
    if (!chunks.length)
      throw new ApiError(
        "No supported, non-empty source files were found.",
        422,
        "NO_SOURCE_FILES",
      );
    await progress("EMBEDDING", { chunksTotal: chunks.length });
    const embeddings = await createEmbeddings(chunks.map(buildEmbeddingInput), {
      onBatch: async ({ completed }) =>
        progress("EMBEDDING", { chunksEmbedded: completed }),
    });
    await progress("SAVING");
    await replaceCodeChunks(
      repository.id,
      chunks.map((chunk, index) => ({ chunk, embedding: embeddings[index] })),
      {
        token,
        commitSha,
        signature,
        defaultBranch,
      },
    );
    logEvent("ingestion.complete", {
      repositoryId: repository.id,
      indexReused: false,
      filesIndexed,
      chunksIndexed: chunks.length,
      durationMs: Math.round(performance.now() - started),
    });
    return {
      repositoryId: repository.id,
      repositoryUrl: repository.url,
      filesDiscovered: files.length,
      filesIndexed,
      filesSkipped,
      chunksIndexed: chunks.length,
      indexReused: false,
      commitSha,
    };
  } catch (error) {
    const safeMessage =
      error instanceof ApiError
        ? error.message
        : "Analysis failed. Check database connectivity and the AI provider configuration, then retry.";
    try {
      await db.repository.updateMany({
        where: { id: repository.id, analysisToken: token },
        data: {
          status: repository.indexedAt ? "READY" : "FAILED",
          analysisPhase: "FAILED",
          errorMessage: safeMessage,
        },
      });
    } catch {
      logEvent("ingestion.failure_state_unavailable", {
        repositoryId: repository.id,
      });
    }
    logEvent("ingestion.failed", {
      repositoryId: repository.id,
      phase,
      durationMs: Math.round(performance.now() - started),
    });
    throw error;
  } finally {
    clearInterval(heartbeat);
    await heartbeatPending;
    try {
      await db.repository.updateMany({
        where: { id: repository.id, analysisToken: token },
        data: { analysisToken: null, leaseExpiresAt: null },
      });
    } catch {
      logEvent("ingestion.lease_release_failed", {
        repositoryId: repository.id,
      });
    }
    if (
      clonePath &&
      storageRoot &&
      clonePath.startsWith(storageRoot + path.sep)
    ) {
      try {
        await rm(clonePath, { recursive: true, force: true });
      } catch {
        logEvent("ingestion.cleanup_failed", { repositoryId: repository.id });
      }
    }
  }
}
