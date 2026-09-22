import type { RetrievedChunk } from "@/types/rag";

const DEFAULT_MAX_CONTEXT_CHARACTERS = 48_000;
const MAX_CHARACTERS_PER_CHUNK = 12_000;

function formatChunk(chunk: RetrievedChunk): string {
  const citation = `${chunk.filePath}:${chunk.startLine}-${chunk.endLine}`;
  const content = chunk.content.slice(0, MAX_CHARACTERS_PER_CHUNK);
  return `[${citation}]\n${content}`;
}

export function selectContextChunks(
  chunks: RetrievedChunk[],
  maxCharacters = DEFAULT_MAX_CONTEXT_CHARACTERS,
): RetrievedChunk[] {
  const selected: RetrievedChunk[] = [];
  let totalCharacters = 0;

  for (const chunk of chunks) {
    const sectionLength = formatChunk(chunk).length;
    if (totalCharacters + sectionLength > maxCharacters) {
      continue;
    }

    selected.push(chunk);
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
    .join("\n\n---\n\n");
}
