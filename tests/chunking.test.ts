import { describe, expect, it } from "vitest";
import { chunkSourceFile } from "@/lib/ingestion/chunk-source-file";
const input = { filePath: "src/demo.ts", language: "typescript" };
describe("chunking", () => {
  it("preserves CRLF line numbers and overlap", () => {
    const chunks = chunkSourceFile({
      ...input,
      content: "one\r\ntwo\r\nthree\r\nfour",
      maxLines: 3,
      overlapLines: 1,
    });
    expect(
      chunks.map(({ startLine, endLine }) => [startLine, endLine]),
    ).toEqual([
      [1, 3],
      [3, 4],
    ]);
    expect(chunks[1].content).toBe("three\nfour");
  });
  it("returns no chunks for empty content", () =>
    expect(chunkSourceFile({ ...input, content: "" })).toEqual([]));
  it("bounds long lines without inventing line numbers", () => {
    const chunks = chunkSourceFile({
      ...input,
      content: "hello\n" + "X".repeat(27) + "\nend",
      maxCharacters: 10,
      maxLines: 4,
      overlapLines: 0,
    });
    expect(chunks.every((part) => part.content.length <= 10)).toBe(true);
    for (const part of chunks)
      expect(part.content.split("\n").length).toBe(
        part.endLine - part.startLine + 1,
      );
    expect(
      chunks.map((part) => part.content.replaceAll("\n", "")).join(""),
    ).toBe("hello" + "X".repeat(27) + "end");
  });
  it.each([0, -1, NaN, Infinity, 2.5])(
    "rejects invalid limit %s",
    (maxLines) => {
      expect(() =>
        chunkSourceFile({ ...input, content: "x", maxLines, overlapLines: 0 }),
      ).toThrow();
    },
  );
  it("always makes progress with maximal overlap", () => {
    const chunks = chunkSourceFile({
      ...input,
      content: Array.from({ length: 150 }, (_, i) => String(i)).join("\n"),
      maxLines: 3,
      overlapLines: 2,
    });
    expect(chunks.at(-1)?.endLine).toBe(150);
    expect(chunks.length).toBeLessThan(151);
  });
});
