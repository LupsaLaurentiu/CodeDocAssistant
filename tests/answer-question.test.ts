import { beforeEach, expect, it, vi } from "vitest";
import { chunk } from "./fixtures";
const { embed, retrieve, generate } = vi.hoisted(() => ({
  embed: vi.fn(),
  retrieve: vi.fn(),
  generate: vi.fn(),
}));
vi.mock("@/lib/rag/embeddings", () => ({ createEmbeddings: embed }));
vi.mock("@/lib/rag/retrieval", () => ({ retrieveRelevantChunks: retrieve }));
vi.mock("@/lib/llm/generate-answer", () => ({ generateAnswer: generate }));
import { answerRepositoryQuestion } from "@/lib/rag/answer-question";
beforeEach(() => {
  embed.mockResolvedValue([[0.5]]);
  retrieve.mockResolvedValue([chunk]);
});
it("does not call the chat model without usable context", async () => {
  retrieve.mockResolvedValue([]);
  expect(
    (
      await answerRepositoryQuestion({
        repositoryId: "test",
        question: "Birthday?",
      })
    ).grounding,
  ).toBe("insufficient");
  expect(generate).not.toHaveBeenCalled();
});
it("handles an unanswerable question with retrieved but insufficient context", async () => {
  generate.mockResolvedValue({ status: "insufficient_context", sections: [] });
  const result = await answerRepositoryQuestion({
    repositoryId: "test",
    question: "What is the author's birthday?",
  });
  expect(result.citations).toEqual([]);
  expect(result.consultedSources).toHaveLength(1);
  expect(result.grounding).toBe("insufficient");
});
it("never returns generated prose with an invented source", async () => {
  generate.mockResolvedValue({
    status: "answered",
    sections: [
      {
        text: "A made-up claim",
        citations: [{ sourceId: "S99", startLine: 1, endLine: 2 }],
      },
    ],
  });
  const result = await answerRepositoryQuestion({
    repositoryId: "test",
    question: "What?",
  });
  expect(result.answer).not.toContain("made-up claim");
  expect(result.grounding).toBe("unverified");
});
