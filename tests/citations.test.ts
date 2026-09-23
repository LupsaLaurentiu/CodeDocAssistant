import { describe, expect, it } from "vitest";
import { validateAnswerCitations } from "@/lib/rag/citations";
import { selectContextChunks, buildRagContext } from "@/lib/rag/context";
import { chunk } from "./fixtures";
import type { GeneratedAnswer } from "@/lib/llm/answer-schema";

const answer = (
  sourceId = "S1",
  startLine = 10,
  endLine = 12,
): GeneratedAnswer => ({
  status: "answered",
  sections: [
    {
      text: "The login function validates the session.",
      citations: [{ sourceId, startLine, endLine }],
    },
  ],
});
describe("grounded references", () => {
  it("builds paths only from the retrieved metadata", () => {
    const result = validateAnswerCitations(answer(), [chunk]);
    expect(result.grounding).toBe("verified");
    expect(result.answer).toContain("src/auth.ts:10-12");
    expect(result.citations).toEqual([
      {
        chunkId: chunk.id,
        filePath: chunk.filePath,
        startLine: 10,
        endLine: 12,
      },
    ]);
  });
  it.each([
    ["S9", 10, 12],
    ["S0", 10, 12],
    ["S01", 10, 12],
    ["S1", 9, 12],
    ["S1", 10, 13],
    ["S1", 12, 10],
    ["S1", 10.5, 12],
  ])("rejects invalid reference %s %s %s", (id, start, end) => {
    const result = validateAnswerCitations(
      answer(String(id), Number(start), Number(end)),
      [chunk],
    );
    expect(result.grounding).toBe("unverified");
    expect(result.citations).toEqual([]);
    expect(result.answer).not.toContain("validates the session");
  });
  it("does not equate all consulted sources with citations", () => {
    const result = validateAnswerCitations(answer(), [
      chunk,
      {
        ...chunk,
        id: "22222222-2222-4222-8222-222222222222",
        filePath: "README.md",
      },
    ]);
    expect(result.consultedSources).toHaveLength(2);
    expect(result.citations).toHaveLength(1);
  });
  it("rejects missing citations and fabricated inline labels", () => {
    const uncited = answer();
    uncited.sections[0].citations = [];
    expect(validateAnswerCitations(uncited, [chunk]).grounding).toBe(
      "unverified",
    );
    const fabricated = answer();
    fabricated.sections[0].text = "See secret.ts:1-100";
    expect(validateAnswerCitations(fabricated, [chunk]).grounding).toBe(
      "unverified",
    );
  });
  it("abstains on insufficient context without displaying speculative model prose", () => {
    const result = validateAnswerCitations(
      {
        status: "insufficient_context",
        sections: [{ text: "The birthday is 10 June", citations: [] }],
      },
      [chunk],
    );
    expect(result.grounding).toBe("insufficient");
    expect(result.citations).toEqual([]);
    expect(result.answer).not.toContain("10 June");
  });
  it("deduplicates citations across sections", () => {
    const generated = answer();
    generated.sections.push(generated.sections[0]);
    expect(validateAnswerCitations(generated, [chunk]).citations).toHaveLength(
      1,
    );
  });
});
describe("bounded line-exact context", () => {
  it("numbers source lines and includes stable source identifiers", () => {
    expect(buildRagContext([chunk])).toContain("[Source S1]");
    expect(buildRagContext([chunk])).toContain(
      "11:   return validateSession();",
    );
  });
  it("updates endLine after truncating at a line boundary", () => {
    const long = {
      ...chunk,
      content: ["a".repeat(6_000), "b".repeat(6_000), "tail"].join("\n"),
    };
    const selected = selectContextChunks([long]);
    expect(selected[0].endLine).toBe(10);
    expect(selected[0].content).toBe("a".repeat(6_000));
    expect(validateAnswerCitations(answer(), selected).grounding).toBe(
      "unverified",
    );
  });
  it("never exceeds the total serialized context budget", () => {
    const result = buildRagContext(
      Array.from({ length: 15 }, (_, index) => ({
        ...chunk,
        id: String(index),
      })),
      500,
    );
    expect(result.length).toBeLessThanOrEqual(500);
  });
  it("rejects legacy synthetic line mappings and oversized single lines", () => {
    expect(selectContextChunks([{ ...chunk, endLine: 10 }])).toEqual([]);
    expect(
      selectContextChunks([
        { ...chunk, endLine: 10, content: "x".repeat(13_000) },
      ]),
    ).toEqual([]);
  });
});
