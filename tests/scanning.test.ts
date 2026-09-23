import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanRepositoryFiles } from "@/lib/ingestion/scan-repository-files";
const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});
describe("source scanning", () => {
  it("excludes build output, secrets, lock files and binaries", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "codedoc-scan-test-"));
    directories.push(root);
    for (const file of [
      "src/auth.ts",
      "README.md",
      "package.json",
      "package-lock.json",
      "node_modules/lib/a.ts",
      ".git/config.json",
      "dist/a.js",
      ".next/cache/a.json",
      "coverage/a.js",
      ".env",
      "photo.png",
    ]) {
      const destination = path.join(root, file);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, "fixture");
    }
    expect(
      (await scanRepositoryFiles(root)).map((file) => file.relativePath),
    ).toEqual(["README.md", "package.json", "src/auth.ts"]);
  });
  it("does not follow directory symlinks outside the clone", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "codedoc-link-test-"));
    directories.push(root);
    const outside = await mkdtemp(
      path.join(os.tmpdir(), "codedoc-outside-test-"),
    );
    directories.push(outside);
    await writeFile(path.join(outside, "secret.ts"), "not for indexing");
    await symlink(
      outside,
      path.join(root, "external"),
      process.platform === "win32" ? "junction" : "dir",
    );
    expect(await scanRepositoryFiles(root)).toEqual([]);
  });
});
