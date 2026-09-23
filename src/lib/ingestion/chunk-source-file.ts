import type { SourceChunk } from "@/types/rag";

interface ChunkSourceFileOptions {
  filePath: string;
  language: string;
  content: string;
  maxLines?: number;
  overlapLines?: number;
  maxCharacters?: number;
}

export function chunkSourceFile({
  filePath,
  language,
  content,
  maxLines = 120,
  overlapLines = 20,
  maxCharacters = 24_000,
}: ChunkSourceFileOptions): SourceChunk[] {
  if (
    !Number.isInteger(maxLines) ||
    !Number.isInteger(overlapLines) ||
    !Number.isInteger(maxCharacters) ||
    maxLines < 1 ||
    overlapLines < 0 ||
    overlapLines >= maxLines ||
    maxCharacters < 1
  ) {
    throw new Error("Chunk line limits are invalid.");
  }

  const lines = content.split(/\r?\n/);
  if (lines.length === 1 && lines[0] === "") {
    return [];
  }

  const segments = lines.flatMap((line, lineIndex) => {
    if (line.length <= maxCharacters) {
      return [{ content: line, lineNumber: lineIndex + 1 }];
    }

    const parts = [];
    for (let offset = 0; offset < line.length; offset += maxCharacters) {
      parts.push({
        content: line.slice(offset, offset + maxCharacters),
        lineNumber: lineIndex + 1,
      });
    }
    return parts;
  });

  const chunks: SourceChunk[] = [];
  let startIndex = 0;

  while (startIndex < segments.length) {
    let endIndex = startIndex;
    let characterCount = 0;

    while (endIndex < segments.length && endIndex - startIndex < maxLines) {
      if (
        endIndex > startIndex &&
        segments[endIndex].lineNumber !== segments[endIndex - 1].lineNumber + 1
      )
        break;
      const separatorLength = endIndex === startIndex ? 0 : 1;
      const nextLength = segments[endIndex].content.length + separatorLength;
      if (
        endIndex > startIndex &&
        characterCount + nextLength > maxCharacters
      ) {
        break;
      }
      characterCount += nextLength;
      endIndex += 1;
    }

    const chunkSegments = segments.slice(startIndex, endIndex);
    chunks.push({
      filePath,
      language,
      startLine: chunkSegments[0].lineNumber,
      endLine: chunkSegments.at(-1)?.lineNumber ?? chunkSegments[0].lineNumber,
      content: chunkSegments.map((segment) => segment.content).join("\n"),
    });

    if (endIndex === segments.length) {
      break;
    }

    startIndex = Math.max(endIndex - overlapLines, startIndex + 1);
  }

  return chunks;
}
