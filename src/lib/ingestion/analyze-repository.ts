import { mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";

import { simpleGit } from "simple-git";

import { getEnvironment } from "@/config/env";
import { db, replaceCodeChunks } from "@/lib/db";
import { cloneRepository } from "@/lib/github";
import { createEmbeddings } from "@/lib/rag";
import type { SourceChunk } from "@/types/rag";
import type {
  GitHubRepositoryReference,
  RepositoryAnalysisResult,
} from "@/types/repository";

import { chunkSourceFile } from "./chunk-source-file";
import { INGESTION_LIMITS } from "./constants";
import { scanRepositoryFiles } from "./scan-repository-files";

function buildEmbeddingInput(chunk: SourceChunk): string {
  return [
    `File: ${chunk.filePath}`,
    `Language: ${chunk.language}`,
    `Lines: ${chunk.startLine}-${chunk.endLine}`,
    chunk.symbol ? `Symbol: ${chunk.symbol}` : null,
    "",
    chunk.content,
  ]
    .filter((part): part is string => part !== null)
    .join("\n");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message.slice(0, 1_000)
    : "Unknown error";
}

export async function analyzeRepository(
  reference: GitHubRepositoryReference,
): Promise<RepositoryAnalysisResult> {
  const repository = await db.repository.upsert({
    where: { url: reference.url },
    create: {
      url: reference.url,
      owner: reference.owner,
      name: reference.name,
      status: "CLONING",
    },
    update: {
      owner: reference.owner,
      name: reference.name,
      status: "CLONING",
      errorMessage: null,
    },
  });

  const storageRoot = path.resolve(
    /* turbopackIgnore: true */
    process.cwd(),
    getEnvironment().REPOSITORY_STORAGE_PATH,
  );
  await mkdir(storageRoot, { recursive: true });
  const clonePath = await mkdtemp(path.join(storageRoot, `${reference.name}-`));

  try {
    await cloneRepository(reference, clonePath);
    const defaultBranch = await simpleGit(clonePath).revparse([
      "--abbrev-ref",
      "HEAD",
    ]);

    await db.repository.update({
      where: { id: repository.id },
      data: { status: "INDEXING", defaultBranch: defaultBranch.trim() },
    });

    const files = await scanRepositoryFiles(clonePath);
    if (files.length > INGESTION_LIMITS.maxFiles) {
      throw new Error(
        `Repository contains ${files.length} supported files; the current limit is ${INGESTION_LIMITS.maxFiles}.`,
      );
    }

    const chunks: SourceChunk[] = [];
    let indexedBytes = 0;
    let filesIndexed = 0;
    let filesSkipped = 0;

    for (const file of files) {
      const fileStats = await stat(file.absolutePath);
      if (
        fileStats.size === 0 ||
        fileStats.size > INGESTION_LIMITS.maxFileBytes
      ) {
        filesSkipped += 1;
        continue;
      }

      indexedBytes += fileStats.size;
      if (indexedBytes > INGESTION_LIMITS.maxRepositoryBytes) {
        throw new Error(
          `Supported source files exceed the ${INGESTION_LIMITS.maxRepositoryBytes / 1024 / 1024} MB ingestion limit.`,
        );
      }

      const content = await readFile(file.absolutePath, "utf8");
      const fileChunks = chunkSourceFile({
        filePath: file.relativePath,
        language: file.language,
        content,
        maxCharacters: INGESTION_LIMITS.maxChunkCharacters,
      });
      chunks.push(...fileChunks);
      filesIndexed += 1;
    }

    if (chunks.length === 0) {
      throw new Error("No supported, non-empty source files were found.");
    }

    const embeddings = await createEmbeddings(chunks.map(buildEmbeddingInput));
    await replaceCodeChunks(
      repository.id,
      chunks.map((chunk, index) => ({ chunk, embedding: embeddings[index] })),
    );

    return {
      repositoryId: repository.id,
      repositoryUrl: reference.url,
      filesDiscovered: files.length,
      filesIndexed,
      filesSkipped,
      chunksIndexed: chunks.length,
    };
  } catch (error) {
    await db.repository.update({
      where: { id: repository.id },
      data: { status: "FAILED", errorMessage: getErrorMessage(error) },
    });
    throw error;
  } finally {
    await rm(clonePath, { recursive: true, force: true });
  }
}
