"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FileCode2, LoaderCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SourceCitation, SourceCodeExcerpt } from "@/types/rag";

type SourceState =
  | { status: "loading" }
  | { status: "ready"; source: SourceCodeExcerpt }
  | { status: "error"; message: string };

function isSourceCodeExcerpt(value: unknown): value is SourceCodeExcerpt {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.chunkId === "string" &&
    typeof candidate.filePath === "string" &&
    typeof candidate.language === "string" &&
    typeof candidate.startLine === "number" &&
    typeof candidate.endLine === "number" &&
    typeof candidate.content === "string"
  );
}

export function SourceCodeDialog({
  repositoryId,
  citation,
  onClose,
}: {
  repositoryId: string;
  citation: SourceCitation;
  onClose: () => void;
}) {
  const [state, setState] = useState<SourceState>({ status: "loading" });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();

    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function loadSource() {
      try {
        const response = await fetch(
          `/api/repositories/${repositoryId}/chunks/${citation.chunkId}`,
          { signal: controller.signal },
        );
        const payload: unknown = await response.json();
        if (!response.ok) {
          const message =
            typeof payload === "object" && payload !== null
              ? (payload as Record<string, unknown>).error
              : undefined;
          throw new Error(
            typeof message === "string"
              ? message
              : "Could not load source code.",
          );
        }
        const result =
          typeof payload === "object" && payload !== null
            ? (payload as Record<string, unknown>).result
            : undefined;
        if (!isSourceCodeExcerpt(result)) {
          throw new Error("The server returned an invalid source excerpt.");
        }
        setState({ status: "ready", source: result });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Could not load source code.",
        });
      }
    }
    void loadSource();
    return () => controller.abort();
  }, [citation.chunkId, repositoryId]);

  const label = `${citation.filePath}:${citation.startLine}-${citation.endLine}`;

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-5xl overflow-hidden rounded-xl border border-white/10 bg-zinc-950 p-0 text-zinc-200 [color-scheme:dark] shadow-2xl backdrop:bg-black/75 backdrop:backdrop-blur-sm open:flex open:flex-col"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        ) {
          onClose();
        }
      }}
    >
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <FileCode2
            className="size-4 shrink-0 text-blue-300"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h2
              id={titleId}
              className="truncate font-mono text-xs text-zinc-200 sm:text-sm"
              title={label}
            >
              {label}
            </h2>
            {state.status === "ready" && (
              <p className="mt-1 text-xs text-zinc-400">
                {state.source.language}
                {state.source.symbol ? ` · ${state.source.symbol}` : ""}
              </p>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-zinc-400 hover:text-white"
          onClick={onClose}
          aria-label="Close source preview"
        >
          <X aria-hidden="true" />
        </Button>
      </header>
      <div
        className="min-h-0 flex-1 overflow-auto overscroll-contain focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-400"
        tabIndex={0}
        role="region"
        aria-label="Source code"
        aria-busy={state.status === "loading"}
      >
        {state.status === "loading" && (
          <div
            className="flex min-h-56 items-center justify-center gap-2 text-sm text-zinc-400"
            role="status"
          >
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Loading source…
          </div>
        )}
        {state.status === "error" && (
          <div
            className="flex min-h-56 items-center justify-center p-8 text-sm text-red-300"
            role="alert"
          >
            {state.message}
          </div>
        )}
        {state.status === "ready" && (
          <pre className="min-w-max py-4 font-mono text-xs leading-6 sm:text-[13px]">
            {state.source.content.split(/\r?\n/).map((line, index) => (
              <span
                key={`${state.source.startLine + index}-${index}`}
                className="flex px-4 hover:bg-white/5"
              >
                <span
                  className="mr-5 w-10 shrink-0 text-right text-zinc-500 tabular-nums select-none"
                  aria-hidden="true"
                >
                  {state.source.startLine + index}
                </span>
                <code className="text-zinc-300">{line || " "}</code>
              </span>
            ))}
          </pre>
        )}
      </div>
    </dialog>
  );
}
