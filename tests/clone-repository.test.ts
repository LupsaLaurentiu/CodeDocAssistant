import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { simpleGit } from "simple-git";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createCloneEnvironment } from "@/lib/github/clone-environment";
import { cloneRepository } from "@/lib/github/clone-repository";
import { validateRepositoryUrl } from "@/lib/github/validate-repository-url";

const directories: string[] = [];

async function temporaryDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), "codedoc-clone-test-"));
  directories.push(directory);
  return directory;
}

afterEach(async () => {
  vi.unstubAllEnvs();
  for (const directory of directories.splice(0)) {
    const resolved = path.resolve(directory);
    if (
      path.dirname(resolved) !== path.resolve(tmpdir()) ||
      !path.basename(resolved).startsWith("codedoc-clone-test-")
    ) {
      throw new Error("Refusing to remove a path outside clone test fixtures.");
    }
    await rm(resolved, { recursive: true, force: true });
  }
});

describe("isolated clone environment", () => {
  it("preserves OS/network variables while excluding secrets and injected Git settings", () => {
    const source = {
      Path: "fixture-path",
      SystemRoot: "fixture-system-root",
      TEMP: "fixture-temp",
      https_proxy: "http://proxy.example:8080",
      SSL_CERT_FILE: "fixture-ca.pem",
      OPENAI_API_KEY: "test-key-not-used",
      DATABASE_URL: "postgresql://test:test@localhost/test",
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "credential.helper",
      GIT_CONFIG_VALUE_0: "fixture-helper",
      GIT_CONFIG_GLOBAL: "fixture-untrusted-config",
      GIT_CONFIG_SYSTEM: "fixture-untrusted-system-config",
      GIT_ASKPASS: "fixture-askpass",
      SSH_ASKPASS: "fixture-ssh-askpass",
      GIT_TEMPLATE_DIR: "fixture-templates",
    };
    expect(createCloneEnvironment(source)).toEqual({
      Path: source.Path,
      SystemRoot: source.SystemRoot,
      TEMP: source.TEMP,
      https_proxy: source.https_proxy,
      SSL_CERT_FILE: source.SSL_CERT_FILE,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
      GIT_TERMINAL_PROMPT: "0",
      GIT_LFS_SKIP_SMUDGE: "1",
    });
    expect(source.GIT_CONFIG_GLOBAL).toBe("fixture-untrusted-config");
  });
});

describe("real Git cloning (offline fixtures)", () => {
  it("clones through the installed simple-git security checks without borrowing host configuration", async () => {
    const root = await temporaryDirectory();
    const source = path.join(root, "source");
    await mkdir(source);
    const git = simpleGit({
      baseDir: source,
      unsafe: { allowUnsafeConfigPaths: true },
    }).env(createCloneEnvironment());
    await git.init();
    await git.addConfig("user.name", "Clone Test");
    await git.addConfig("user.email", "clone-test@example.invalid");
    await writeFile(path.join(source, "README.md"), "offline clone fixture\n");
    await git.add("README.md");
    await git.commit("Create offline fixture");

    // These inherited values must not reach simple-git or its Git child.
    vi.stubEnv("GIT_CONFIG_COUNT", "1");
    vi.stubEnv("GIT_CONFIG_KEY_0", "credential.helper");
    vi.stubEnv("GIT_CONFIG_VALUE_0", "fixture-helper-must-not-run");
    vi.stubEnv("GIT_CONFIG_GLOBAL", path.join(root, "invalid.gitconfig"));
    await writeFile(process.env.GIT_CONFIG_GLOBAL!, "[invalid config\n");

    const destination = path.join(root, "destination");
    const reference = {
      ...validateRepositoryUrl("https://github.com/codedoc-fixtures/offline"),
      cloneUrl: pathToFileURL(source).href,
    };
    expect(await cloneRepository(reference, destination)).toBe(destination);
    expect(await readFile(path.join(destination, "README.md"), "utf8")).toBe(
      "offline clone fixture\n",
    );
    await expect(
      access(path.join(destination, ".git", "shallow")),
    ).resolves.toBeUndefined();
  });

  it("does not overwrite an occupied destination", async () => {
    const root = await temporaryDirectory();
    const existing = path.join(root, "keep.txt");
    await writeFile(existing, "keep me");
    await expect(
      cloneRepository(
        validateRepositoryUrl("https://github.com/example/repo"),
        root,
      ),
    ).rejects.toThrow("Clone destination is not empty");
    expect(await readFile(existing, "utf8")).toBe("keep me");
  });

  it("propagates real Git failures without returning a successful clone path", async () => {
    const root = await temporaryDirectory();
    await expect(
      cloneRepository(
        {
          ...validateRepositoryUrl(
            "https://github.com/codedoc-fixtures/missing",
          ),
          cloneUrl: pathToFileURL(path.join(root, "missing-source")).href,
        },
        path.join(root, "destination"),
      ),
    ).rejects.toThrow();
  });
});

describe.skipIf(!process.env.TEST_PUBLIC_REPOSITORY_URL)(
  "opt-in public GitHub clone smoke test (no OpenAI calls)",
  () => {
    it("clones the requested public repository", async () => {
      const root = await temporaryDirectory();
      const reference = validateRepositoryUrl(
        process.env.TEST_PUBLIC_REPOSITORY_URL!,
      );
      const destination = await cloneRepository(
        reference,
        path.join(root, "repository"),
      );
      await expect(
        access(path.join(destination, ".git", "HEAD")),
      ).resolves.toBeUndefined();
    }, 130_000);
  },
);
