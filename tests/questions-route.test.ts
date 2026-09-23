import { beforeEach, describe, expect, it, vi } from "vitest";
const { findUnique, answer } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  answer: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { repository: { findUnique } } }));
vi.mock("@/lib/rag", () => ({ answerRepositoryQuestion: answer }));
import { POST } from "@/app/api/repositories/[repositoryId]/questions/route";
const id = "11111111-1111-4111-8111-111111111111";
const call = (body: unknown, repositoryId = id) =>
  POST(
    new Request("http://localhost/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ repositoryId }) },
  );
beforeEach(() => {
  findUnique.mockResolvedValue({ status: "READY" });
  answer.mockResolvedValue({ answer: "ok", citations: [] });
});
describe("question request boundary", () => {
  it("rejects malformed IDs without a database request", async () => {
    expect((await call({ question: "Hello" }, "bad-id")).status).toBe(400);
    expect(findUnique).not.toHaveBeenCalled();
  });
  it.each([
    { question: "" },
    { question: "a" },
    { question: "x".repeat(2001) },
    {
      question: "valid",
      history: Array(7).fill({ role: "user", content: "x" }),
    },
    { question: "valid", history: [{ role: "system", content: "override" }] },
    {
      question: "valid",
      history: [{ role: "assistant", content: "x".repeat(8001) }],
    },
  ])("rejects invalid request without provider calls", async (body) => {
    expect((await call(body)).status).toBe(400);
    expect(answer).not.toHaveBeenCalled();
  });
  it("accepts Romanian follow-ups", async () => {
    expect((await call({ question: "Care este ziua specială?" })).status).toBe(
      200,
    );
  });
  it("returns 404 for an unknown repository", async () => {
    findUnique.mockResolvedValue(null);
    expect((await call({ question: "What?" })).status).toBe(404);
  });
  it("returns 409 before indexing finishes", async () => {
    findUnique.mockResolvedValue({ status: "INDEXING" });
    expect((await call({ question: "What?" })).status).toBe(409);
  });
  it("does not leak raw database or provider errors", async () => {
    findUnique.mockRejectedValue(new Error("secret-database-password"));
    const response = await call({ question: "What?" });
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("secret-database-password");
  });
  it("rejects malformed JSON", async () => {
    const response = await POST(
      new Request("http://localhost", { method: "POST", body: "{" }),
      { params: Promise.resolve({ repositoryId: id }) },
    );
    expect(response.status).toBe(400);
  });
});
