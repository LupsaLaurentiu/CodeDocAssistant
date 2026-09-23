"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { progressSchema } from "@/lib/ingestion/progress-schema";
import type { RepositoryAnalysisProgress } from "@/types/repository";

const LABELS = {
  IDLE: "Waiting to start",
  CLONING: "Cloning repository",
  SCANNING: "Finding supported files",
  CHUNKING: "Preparing source chunks",
  EMBEDDING: "Generating embeddings",
  SAVING: "Saving index",
  COMPLETE: "Index ready",
  FAILED: "Analysis needs attention",
};

export function AnalysisProgress({
  url,
  attempt,
}: {
  url: string;
  attempt: number;
}) {
  const [progress, setProgress] = useState<RepositoryAnalysisProgress>();
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      try {
        const response = await fetch(
          `/api/repositories/status?url=${encodeURIComponent(url)}`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (response.status === 404) {
          setProgress(undefined);
          setUnavailable(false);
        } else {
          if (!response.ok) throw new Error("Progress unavailable");
          const payload: unknown = await response.json();
          const result = progressSchema.parse(
            typeof payload === "object" &&
              payload !== null &&
              "result" in payload
              ? payload.result
              : undefined,
          );
          if (controller.signal.aborted) return;
          setProgress(result);
          setUnavailable(false);
        }
      } catch {
        if (!controller.signal.aborted) setUnavailable(true);
      }
      if (!controller.signal.aborted)
        timer = setTimeout(() => void poll(), 2_000);
    }
    void poll();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [url, attempt]);
  return (
    <div
      className="rounded-lg border border-white/10 bg-black/20 p-3 text-left text-xs leading-6 text-zinc-300"
      aria-live="polite"
    >
      {unavailable ? (
        <p>
          Progress is temporarily unavailable. The analysis may still be
          running.
        </p>
      ) : !progress ? (
        <p>Waiting for the server to start analysis…</p>
      ) : (
        <>
          <p className="font-medium text-zinc-100">{LABELS[progress.phase]}</p>
          {["CHUNKING", "EMBEDDING", "SAVING"].includes(progress.phase) && (
            <p>
              Files processed: {progress.filesProcessed}/
              {progress.filesDiscovered} · Skipped: {progress.filesSkipped}
            </p>
          )}
          {["EMBEDDING", "SAVING"].includes(progress.phase) && (
            <p>
              Chunks embedded: {progress.chunksEmbedded}/{progress.chunksTotal}
            </p>
          )}
          {progress.indexReused && (
            <p>
              Unchanged commit and index configuration. Existing embeddings
              reused.
            </p>
          )}
          {progress.error && <p className="text-amber-200">{progress.error}</p>}
          {progress.status === "READY" && (
            <Link
              className="inline-block py-1 text-blue-300 underline underline-offset-4"
              href={`/repositories/${progress.repositoryId}`}
            >
              Open existing index
            </Link>
          )}
        </>
      )}
    </div>
  );
}
