import { vi } from "vitest";
process.env.OPENAI_API_KEY = "test-key-never-used";
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/test";
vi.stubGlobal(
  "fetch",
  vi.fn(() =>
    Promise.reject(
      new Error(
        "Network calls are disabled in unit tests. Mock the provider explicitly.",
      ),
    ),
  ),
);
