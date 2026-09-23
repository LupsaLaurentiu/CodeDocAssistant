import { describe, expect, it, vi } from "vitest";
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
  it.each([
    "The implementation is in `src/auth.ts:10-12`.",
    "The implementation is in **src/auth.ts:10-12**.",
    "The implementation (src/auth.ts:11) validates the session.",
    "The implementation is described in [S1].",
  ])(
    "accepts a repeated inline reference only after validating it: %s",
    (text) => {
      const generated = answer();
      generated.sections[0].text = text;
      const result = validateAnswerCitations(generated, [chunk]);
      expect(result.grounding).toBe("verified");
      expect(result.answer).not.toContain("[S1]");
      expect(result.citations).toHaveLength(1);
    },
  );
  it.each([
    "See [S9].",
    "See [S01].",
    "See src/auth.ts:9-12.",
    "See src/auth.ts:12-10.",
    "See src/auth.ts:10-13.",
    "See src/auth.ts:10.5.",
    "See src/auth.ts:10-11.5.",
    "See fake/src/auth.ts:10-12.",
    "See secret.ts:10-12.",
    "See https://example.test/secret.ts:10-12.",
  ])("still rejects invented or inconsistent inline references: %s", (text) => {
    const generated = answer();
    generated.sections[0].text = text;
    expect(validateAnswerCitations(generated, [chunk]).grounding).toBe(
      "unverified",
    );
  });
  it("does not accept an inline source merely because it was retrieved", () => {
    const generated = answer();
    generated.sections[0].text = "See README.md:10-12.";
    const other = { ...chunk, id: "other", filePath: "README.md" };
    expect(validateAnswerCitations(generated, [chunk, other]).grounding).toBe(
      "unverified",
    );
  });
  it.each([
    "Connect to 127.0.0.1:3000.",
    "Connect to https://127.0.0.1:3000/.",
    "Connect to https://example.test:8443/.",
  ])("does not confuse an IP or URL port with a file citation: %s", (text) => {
    const generated = answer();
    generated.sections[0].text = text;
    expect(validateAnswerCitations(generated, [chunk]).grounding).toBe(
      "verified",
    );
  });
  it("supports cited Next.js paths containing brackets and route groups", () => {
    const filePath = "apps/web/src/app/[locale]/(checkout)/layout.tsx";
    const generated = answer();
    generated.sections[0].text = `The checkout layout is in \`${filePath}:10-12\`.`;
    expect(
      validateAnswerCitations(generated, [{ ...chunk, filePath }]).grounding,
    ).toBe("verified");
  });
  it("logs the rejection category without source content or generated text", () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    validateAnswerCitations(answer("S99"), [chunk]);
    const serialized = log.mock.calls[0][0] as string;
    expect(JSON.parse(serialized)).toMatchObject({
      event: "rag.citation_rejected",
      reason: "source_id",
      sectionIndex: 0,
    });
    expect(serialized).not.toContain(chunk.content);
    expect(serialized).not.toContain("login function");
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
