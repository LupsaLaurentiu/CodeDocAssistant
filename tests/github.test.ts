import { describe, expect, it } from "vitest";
import { validateRepositoryUrl } from "@/lib/github/validate-repository-url";
describe("GitHub URL allowlist", () => {
  it("normalizes repository suffix/query/fragment without executing Git", () => {
    expect(
      validateRepositoryUrl(
        "https://github.com/Owner/repo.git/?tab=readme#readme",
      ).url,
    ).toBe("https://github.com/Owner/repo");
  });
  it.each([
    "not a url",
    "http://github.com/a/b",
    "https://evil.test/a/b",
    "file:///tmp/repo",
    "https://github.com/a/b/tree/main",
    "https://github.com/a",
    "https://u:secret@github.com/a/b",
    "https://github.com:8080/a/b",
    "https://github.com/a/%2e%2e",
    "https://github.com/a/.git",
  ])("rejects %s", (url) => expect(() => validateRepositoryUrl(url)).toThrow());
});
