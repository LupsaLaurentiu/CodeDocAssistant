import { zodTextFormat } from "openai/helpers/zod";
import { describe, expect, it } from "vitest";
import { createAnswerSchema } from "@/lib/llm/answer-schema";
import { selectContextChunks } from "@/lib/rag/context";
import { chunk } from "./fixtures";

const chunks = [
  chunk,
  { ...chunk, id: "second", startLine: 100, endLine: 102 },
];
const generated = (sourceId = "S1", startLine = 10, endLine = 12) => ({
  status: "answered",
  sections: [
    {
      text: "Architecture overview.",
      citations: [{ sourceId, startLine, endLine }],
    },
  ],
});

describe("request-specific answer schema", () => {
  it("accepts the supplied sources and their respective ranges", () => {
    const schema = createAnswerSchema(chunks);
    expect(schema.safeParse(generated()).success).toBe(true);
    expect(schema.safeParse(generated("S2", 100, 102)).success).toBe(true);
    expect(
      schema.safeParse({ status: "insufficient_context", sections: [] })
        .success,
    ).toBe(true);
  });
  it.each([
    ["S9", 10, 12],
    ["S01", 10, 12],
    ["S1", 9, 12],
    ["S1", 10, 13],
    ["S1", 100, 102],
    ["S2", 10, 12],
  ])("rejects a reference outside this request: %s %s %s", (id, start, end) => {
    expect(
      createAnswerSchema(chunks).safeParse(
        generated(String(id), Number(start), Number(end)),
      ).success,
    ).toBe(false);
  });
  it("enforces the validator's section and per-section citation limits", () => {
    const schema = createAnswerSchema(chunks);
    const value = generated();
    expect(
      schema.safeParse({
        ...value,
        sections: Array(13).fill(value.sections[0]),
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        ...value,
        sections: [{ text: "overview", citations: [] }],
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        ...value,
        sections: [
          {
            text: "overview",
            citations: Array(13).fill(value.sections[0].citations[0]),
          },
        ],
      }).success,
    ).toBe(false);
  });
  it("constrains ranges after context truncation", () => {
    const selected = selectContextChunks([
      { ...chunk, content: `${"a".repeat(6_000)}\n${"b".repeat(6_000)}\ntail` },
    ]);
    const schema = createAnswerSchema(selected);
    expect(schema.safeParse(generated("S1", 10, 10)).success).toBe(true);
    expect(schema.safeParse(generated()).success).toBe(false);
  });
  it("produces a strict OpenAI schema with nested per-source alternatives", () => {
    const format = zodTextFormat(
      createAnswerSchema(chunks),
      "repository_answer",
    );
    expect(format.strict).toBe(true);
    expect(format.schema).toMatchObject({
      type: "object",
      properties: {
        sections: {
          maxItems: 12,
          items: {
            properties: {
              citations: {
                minItems: 1,
                maxItems: 12,
                items: {
                  anyOf: [
                    expect.objectContaining({
                      properties: expect.objectContaining({
                        startLine: expect.objectContaining({
                          minimum: 10,
                          maximum: 12,
                        }),
                      }),
                    }),
                    expect.objectContaining({
                      properties: expect.objectContaining({
                        startLine: expect.objectContaining({
                          minimum: 100,
                          maximum: 102,
                        }),
                      }),
                    }),
                  ],
                },
              },
            },
          },
        },
      },
    });
    expect(format.schema).not.toHaveProperty("anyOf");
  });
  it("does not generate an unconstrained schema when there are no sources", () => {
    expect(() => createAnswerSchema([])).toThrow("requires source context");
  });
});
