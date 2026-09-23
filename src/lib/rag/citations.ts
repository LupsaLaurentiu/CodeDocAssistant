import type { GeneratedAnswer } from "@/lib/llm/answer-schema";
import { logEvent } from "@/lib/observability";
import {
  formatCitation,
  validateInlineReferences,
  type ValidatedReference,
} from "./inline-references";
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
  reason:
    | "sections"
    | "section_shape"
    | "source_id"
    | "line_range"
    | "inline_reference"
    | "answer_size",
  sectionIndex?: number,
): Omit<RepositoryAnswer, "retrievedChunks"> {
  // Reason codes and counts only: never log generated prose or repository content.
  logEvent("rag.citation_rejected", {
    reason,
    sectionIndex,
    contextChunks: chunks.length,
  });
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

/** Resolve IDs to trusted paths and verify any repeated inline references. */
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
    return unverified(chunks, "sections");
  const citations = new Map<string, SourceCitation>();
  const rendered: string[] = [];
  for (const [sectionIndex, section] of generated.sections.entries()) {
    if (
      !section.text.trim() ||
      section.text.length > 8_000 ||
      !section.citations.length ||
      section.citations.length > 12
    )
      return unverified(chunks, "section_shape", sectionIndex);
    const labels = new Set<string>();
    const sectionReferences: ValidatedReference[] = [];
    for (const reference of section.citations) {
      const match = /^S([1-9]\d*)$/.exec(reference.sourceId);
      const chunk = match ? chunks[Number(match[1]) - 1] : undefined;
      if (!chunk) return unverified(chunks, "source_id", sectionIndex);
      if (
        !Number.isInteger(reference.startLine) ||
        !Number.isInteger(reference.endLine) ||
        reference.startLine < chunk.startLine ||
        reference.endLine > chunk.endLine ||
        reference.endLine < reference.startLine
      )
        return unverified(chunks, "line_range", sectionIndex);
      const citation = {
        chunkId: chunk.id,
        filePath: chunk.filePath,
        startLine: reference.startLine,
        endLine: reference.endLine,
      };
      citations.set(
        `${citation.chunkId}:${citation.startLine}:${citation.endLine}`,
        citation,
      );
      sectionReferences.push({ sourceId: reference.sourceId, citation });
      labels.add(formatCitation(citation));
    }
    const text = validateInlineReferences(section.text, sectionReferences);
    if (text === null)
      return unverified(chunks, "inline_reference", sectionIndex);
    rendered.push(`${text.trim()}\n\nSources: ${[...labels].join(", ")}`);
  }
  if (citations.size > 32 || rendered.join("\n\n").length > 60_000)
    return unverified(chunks, "answer_size");
  return {
    answer: rendered.join("\n\n"),
    citations: [...citations.values()],
    consultedSources: sources,
    grounding: "verified",
  };
}
