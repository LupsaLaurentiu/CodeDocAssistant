import { afterEach, expect, it, vi } from "vitest";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});
it("rejects non-PostgreSQL connection strings without exposing their value", async () => {
  vi.stubEnv("DATABASE_URL", "https://secret:password@example.com/test");
  const { getEnvironment } = await import("@/config/env");
  expect(() => getEnvironment()).toThrow("postgres");
  try {
    getEnvironment();
  } catch (error) {
    expect(String(error)).not.toContain("password@example.com");
  }
});
it("gives a clear error when the API key is missing", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  const { getEnvironment } = await import("@/config/env");
  expect(() => getEnvironment()).toThrow("OPENAI_API_KEY is required");
});
