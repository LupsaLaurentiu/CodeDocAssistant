import type { GeneratedAnswer } from "@/lib/llm/answer-schema";
import type {
  RepositoryAnswer,
  RetrievedChunk,
  SourceCitation,
} from "@/types/rag";

export const INSUFFICIENT_ANSWER =
  "I could not find enough evidence in the retrieved source code to answer this question. Try naming a file, symbol, or feature. This does not prove the feature is absent from the repository.";

export function consultedSources(chunks: RetrievedChunk[]): SourceCitation[] {
  return chunks.map((chunk) => ({
    chunkId: chunk.id,
    filePath: chunk.filePath,
    startLine: chunk.startLine,
    endLine: chunk.endLine,
  }));
}

function unverified(
  chunks: RetrievedChunk[],
): Omit<RepositoryAnswer, "retrievedChunks"> {
  return {
    answer:
      "The generated answer contained references that could not be verified, so it was not displayed. Try asking a more specific question or inspect the consulted sources.",
    grounding: "unverified",
    citations: [],
    consultedSources: consultedSources(chunks),
    warning:
      "An invalid or missing source reference was rejected. No unverified answer was presented.",
  };
}

/** Resolve model IDs to trusted paths. Never let the model manufacture citation labels. */
export function validateAnswerCitations(
  generated: GeneratedAnswer,
  chunks: RetrievedChunk[],
): Omit<RepositoryAnswer, "retrievedChunks"> {
  const sources = consultedSources(chunks);
  if (generated.status === "insufficient_context") {
    return {
      answer: INSUFFICIENT_ANSWER,
      grounding: "insufficient",
      citations: [],
      consultedSources: sources,
    };
  }
  if (!generated.sections.length || generated.sections.length > 12)
    return unverified(chunks);
  const citations = new Map<string, SourceCitation>();
  const rendered: string[] = [];
  for (const section of generated.sections) {
    if (
      !section.text.trim() ||
      section.text.length > 8_000 ||
      !section.citations.length ||
      section.citations.length > 12
    )
      return unverified(chunks);
    if (/(?:[\w./-]+\.[\w-]+):\d+(?:-\d+)?|\[S\d+\]/.test(section.text))
      return unverified(chunks);
    const labels = new Set<string>();
    for (const reference of section.citations) {
      const match = /^S([1-9]\d*)$/.exec(reference.sourceId);
      const chunk = match ? chunks[Number(match[1]) - 1] : undefined;
      if (
        !chunk ||
        !Number.isInteger(reference.startLine) ||
        !Number.isInteger(reference.endLine) ||
        reference.startLine < chunk.startLine ||
        reference.endLine > chunk.endLine ||
        reference.endLine < reference.startLine
      )
        return unverified(chunks);
      const citation = {
        chunkId: chunk.id,
        filePath: chunk.filePath,
        startLine: reference.startLine,
        endLine: reference.endLine,
      };
      const label = `${citation.filePath}:${citation.startLine}-${citation.endLine}`;
      citations.set(
        `${citation.chunkId}:${citation.startLine}:${citation.endLine}`,
        citation,
      );
      // A long code fence avoids repository filenames breaking Markdown code spans.
      const fence = "`".repeat(
        Math.max(1, ...(label.match(/`+/g) ?? []).map((run) => run.length + 1)),
      );
      labels.add(`${fence} ${label} ${fence}`);
    }
    rendered.push(
      `${section.text.trim()}\n\nSources: ${[...labels].join(", ")}`,
    );
  }
  if (citations.size > 32 || rendered.join("\n\n").length > 60_000)
    return unverified(chunks);
  return {
    answer: rendered.join("\n\n"),
    citations: [...citations.values()],
    consultedSources: sources,
    grounding: "verified",
  };
}
