"use client";
import { FileCode2 } from "lucide-react";
import type { SourceCitation } from "@/types/rag";

export function AnswerSources({
  sources,
  onSelect,
}: {
  sources: SourceCitation[];
  onSelect: (source: SourceCitation) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {sources.map((source) => {
        const label = `${source.filePath}:${source.startLine}-${source.endLine}`;
        return (
          <button
            key={`${source.chunkId}:${source.startLine}:${source.endLine}`}
            type="button"
            className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-md border border-blue-400/20 bg-blue-400/10 px-2.5 py-1.5 font-mono text-xs text-blue-200 hover:bg-blue-400/15 focus-visible:outline-2 focus-visible:outline-blue-400"
            title={`Open ${label}`}
            onClick={() => onSelect(source)}
          >
            <FileCode2 className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
