import path from "node:path";

import fastGlob from "fast-glob";

import type { ScannedSourceFile } from "@/types/repository";

import { IGNORED_GLOBS, SUPPORTED_EXTENSIONS } from "./constants";
import { detectLanguage } from "./detect-language";

export async function scanRepositoryFiles(
  repositoryPath: string,
): Promise<ScannedSourceFile[]> {
  const absoluteRoot = path.resolve(repositoryPath);
  const extensionPattern = SUPPORTED_EXTENSIONS.join(",");
  const relativePaths = await fastGlob(`**/*.{${extensionPattern}}`, {
    cwd: absoluteRoot,
    absolute: false,
    onlyFiles: true,
    followSymbolicLinks: false,
    ignore: [...IGNORED_GLOBS],
  });

  return relativePaths.sort().map((relativePath) => ({
    relativePath: relativePath.split(path.sep).join("/"),
    absolutePath: path.join(absoluteRoot, relativePath),
    language: detectLanguage(relativePath),
  }));
}

export function filterSupportedFiles(filePaths: string[]): string[] {
  const supported = new Set(
    SUPPORTED_EXTENSIONS.map((extension) => `.${extension}`),
  );
  return filePaths.filter((filePath) =>
    supported.has(path.extname(filePath).toLowerCase()),
  );
}
