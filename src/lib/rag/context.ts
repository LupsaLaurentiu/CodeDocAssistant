import type { RetrievedChunk } from "@/types/rag";

const DEFAULT_MAX_CONTEXT_CHARACTERS = 48_000;
const MAX_CHARACTERS_PER_CHUNK = 12_000;
const SEPARATOR = "\n\n---\n\n";

function formatChunk(chunk: RetrievedChunk, index: number): string {
  const lines = chunk.content
    .split(/\r?\n/)
    .map((line, offset) => `${chunk.startLine + offset}: ${line}`)
    .join("\n");
  return `[Source S${index + 1}] ${JSON.stringify({ file: chunk.filePath, startLine: chunk.startLine, endLine: chunk.endLine })}\n${lines}`;
}

/** Cut at line boundaries and update metadata to match exactly what the model sees. */
export function selectContextChunks(
  chunks: RetrievedChunk[],
  maxCharacters = DEFAULT_MAX_CONTEXT_CHARACTERS,
): RetrievedChunk[] {
  if (!Number.isInteger(maxCharacters) || maxCharacters < 1) return [];
  const selected: RetrievedChunk[] = [];
  let totalCharacters = 0;
  for (const chunk of chunks) {
    const lines: string[] = [];
    let contentLength = 0;
    // Legacy chunks with synthetic line breaks cannot be safely line-cited.
    if (
      chunk.content.split(/\r?\n/).length !==
      chunk.endLine - chunk.startLine + 1
    )
      continue;
    for (const line of chunk.content.split(/\r?\n/)) {
      const length = line.length + (lines.length ? 1 : 0);
      if (contentLength + length > MAX_CHARACTERS_PER_CHUNK) break;
      lines.push(line);
      contentLength += length;
    }
    if (!lines.length || !lines.join("\n").trim()) continue;
    const bounded = {
      ...chunk,
      content: lines.join("\n"),
      endLine: chunk.startLine + lines.length - 1,
    };
    const sectionLength =
      formatChunk(bounded, selected.length).length +
      (selected.length ? SEPARATOR.length : 0);
    if (totalCharacters + sectionLength > maxCharacters) continue;
    selected.push(bounded);
    totalCharacters += sectionLength;
  }
  return selected;
}

export function buildRagContext(
  chunks: RetrievedChunk[],
  maxCharacters = DEFAULT_MAX_CONTEXT_CHARACTERS,
): string {
  return selectContextChunks(chunks, maxCharacters)
    .map(formatChunk)
    .join(SEPARATOR);
}
