import { access, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

import { simpleGit } from "simple-git";

import type { GitHubRepositoryReference } from "@/types/repository";
import { createCloneEnvironment } from "./clone-environment";

export async function cloneRepository(
  repository: GitHubRepositoryReference,
  destination: string,
): Promise<string> {
  const absoluteDestination = path.resolve(destination);

  try {
    await access(absoluteDestination);
    const contents = await readdir(absoluteDestination);
    if (contents.length > 0) {
      throw new Error(`Clone destination is not empty: ${absoluteDestination}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
    await mkdir(absoluteDestination, { recursive: true });
  }

  // simple-git replaces (rather than merges) the child environment. The only
  // config-path override is our fixed OS null device, never a user-provided file.
  const git = simpleGit({
    baseDir: absoluteDestination,
    timeout: { block: 120_000 },
    unsafe: { allowUnsafeConfigPaths: true },
  }).env(createCloneEnvironment());

  await git.clone(repository.cloneUrl, absoluteDestination, [
    "--depth=1",
    "--single-branch",
  ]);

  return absoluteDestination;
}
