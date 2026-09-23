import { access, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

import { simpleGit } from "simple-git";

import type { GitHubRepositoryReference } from "@/types/repository";

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

  const git = simpleGit({ timeout: { block: 120_000 } });
  git.env("GIT_TERMINAL_PROMPT", "0");
  // Public repositories only: never borrow the developer's cached Git credentials.
  git.env("GIT_CONFIG_COUNT", "1");
  git.env("GIT_CONFIG_KEY_0", "credential.helper");
  git.env("GIT_CONFIG_VALUE_0", "");
  git.env("GIT_LFS_SKIP_SMUDGE", "1");

  await git.clone(repository.cloneUrl, absoluteDestination, [
    "--depth=1",
    "--single-branch",
  ]);

  return absoluteDestination;
}
