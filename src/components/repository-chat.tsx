"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDown,
  Bot,
  LoaderCircle,
  MessageSquarePlus,
  RotateCcw,
  Send,
  Sparkles,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownAnswer } from "@/components/markdown-answer";
import { SourceCodeDialog } from "@/components/source-code-dialog";
import { AnswerSources } from "@/components/answer-sources";
import { CopyAnswer } from "@/components/copy-answer";
import { useRepositoryConversation } from "@/lib/chat/use-repository-conversation";
import type { SourceCitation } from "@/types/rag";

const SUGGESTED_QUESTIONS = [
  "Explain the architecture of this repository.",
  "How does authentication work?",
  "What API endpoints exist?",
  "Which external dependencies are used?",
];

export function RepositoryChat({
  repositoryId,
  repositoryName,
  indexRevision,
}: {
  repositoryId: string;
  repositoryName: string;
  indexRevision: string;
}) {
  const { turns, ready, isLoading, notice, storageError, ask, retry, clear } =
    useRepositoryConversation(repositoryId, indexRevision);
  const [question, setQuestion] = useState("");
  const [selectedCitation, setSelectedCitation] = useState<SourceCitation>();
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const latestRef = useRef<HTMLElement>(null);
  const followRef = useRef(true);

  function jumpToLatest() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const latest = latestRef.current;
    const top = latest
      ? latest.getBoundingClientRect().top -
        viewport.getBoundingClientRect().top +
        viewport.scrollTop -
        16
      : viewport.scrollHeight;
    viewport.scrollTo({
      top,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
    followRef.current = true;
    setShowJumpToLatest(false);
  }
  useEffect(() => {
    if (!followRef.current) return;
    const viewport = viewportRef.current;
    const latest = latestRef.current;
    if (viewport && latest)
      viewport.scrollTop +=
        latest.getBoundingClientRect().top -
        viewport.getBoundingClientRect().top -
        16;
  }, [turns]);

  function submit(value: string) {
    if (ask(value)) {
      followRef.current = true;
      setQuestion("");
    }
  }
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit(question);
  }

  return (
    <section
      className="flex h-full min-h-0 flex-col"
      aria-label="Repository chat"
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3 sm:px-6 [@media(max-height:600px)]:py-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-medium text-zinc-100">
            <Sparkles
              className="size-4 shrink-0 text-blue-300"
              aria-hidden="true"
            />
            <span className="truncate">Ask {repositoryName}</span>
          </h2>
          <p className="mt-1 text-xs text-zinc-400 [@media(max-height:600px)]:hidden">
            Saved on this browser · Last 30 turns
          </p>
        </div>
        <button
          type="button"
          onClick={clear}
          disabled={!ready || isLoading || !turns.length}
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-2 text-xs text-zinc-300 hover:bg-white/5 disabled:opacity-40"
          aria-label="New conversation"
        >
          <MessageSquarePlus className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">New conversation</span>
        </button>
      </header>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={viewportRef}
          role="region"
          aria-label="Conversation"
          tabIndex={0}
          className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-400/50 sm:px-6 sm:py-7"
          onScroll={(event) => {
            const v = event.currentTarget;
            const nearBottom =
              v.scrollHeight - v.scrollTop - v.clientHeight < 100;
            followRef.current = nearBottom;
            setShowJumpToLatest(!nearBottom);
          }}
        >
          {(notice || storageError) && (
            <p
              role="status"
              className="mx-auto mb-4 max-w-3xl rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-5 text-amber-200"
            >
              {storageError ?? notice}
            </p>
          )}
          {!ready ? (
            <p role="status" className="text-center text-sm text-zinc-400">
              Restoring conversation…
            </p>
          ) : !turns.length ? (
            <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center py-4 text-center">
              <span className="flex size-11 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-400/10">
                <Bot className="size-5 text-blue-300" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-zinc-100">
                Explore this codebase
              </h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">
                Ask about architecture, implementation details, dependencies, or
                where a feature lives.
              </p>
              <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
                {SUGGESTED_QUESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => submit(suggestion)}
                    disabled={isLoading}
                    className="rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-left text-sm leading-6 text-zinc-300 hover:border-blue-400/30 hover:bg-blue-400/5 focus-visible:outline-2 focus-visible:outline-blue-400"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div
              className="mx-auto max-w-3xl space-y-8 pb-8"
              role="log"
              aria-label="Messages"
              aria-live="polite"
            >
              {turns.map((turn, index) => (
                <article
                  key={turn.id}
                  ref={index === turns.length - 1 ? latestRef : undefined}
                  className="space-y-6"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                      <User
                        className="size-4 text-zinc-400"
                        aria-hidden="true"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="mb-2 text-xs text-zinc-400">You</p>
                      <p className="rounded-lg bg-white/5 px-3 py-2.5 text-[15px] leading-7 wrap-anywhere whitespace-pre-wrap text-zinc-100">
                        {turn.question}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                      <Bot
                        className="size-4 text-blue-300"
                        aria-hidden="true"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="mb-2 text-xs text-zinc-400">Assistant</p>
                      {turn.status === "pending" && (
                        <p
                          role="status"
                          className="flex items-center gap-2 text-sm text-zinc-400"
                        >
                          <LoaderCircle
                            className="size-4 animate-spin"
                            aria-hidden="true"
                          />
                          Searching sources and checking references…
                        </p>
                      )}
                      {turn.status === "failed" && (
                        <div className="rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">
                          <p role="alert">{turn.error}</p>
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => retry(turn.id)}
                            className="mt-3 inline-flex items-center gap-2 rounded-md border border-red-300/20 px-3 py-2 disabled:opacity-50"
                          >
                            <RotateCcw
                              className="size-3.5"
                              aria-hidden="true"
                            />
                            Retry question
                          </button>
                        </div>
                      )}
                      {turn.status === "answered" && turn.answer && (
                        <>
                          <MarkdownAnswer content={turn.answer.answer} />
                          {turn.answer.warning && (
                            <p className="mt-3 text-xs leading-5 text-amber-200">
                              {turn.answer.warning}
                            </p>
                          )}
                          {turn.answer.citations.length > 0 && (
                            <div className="mt-4 border-t border-white/5 pt-3">
                              <h3 className="mb-2 text-xs font-medium text-zinc-400">
                                Cited sources · file and line references checked
                              </h3>
                              <AnswerSources
                                sources={turn.answer.citations}
                                onSelect={setSelectedCitation}
                              />
                            </div>
                          )}
                          {turn.answer.consultedSources.length > 0 && (
                            <details className="mt-3 text-xs text-zinc-400">
                              <summary className="cursor-pointer py-2">
                                Consulted sources (
                                {turn.answer.consultedSources.length})
                              </summary>
                              <p className="mb-2 leading-5">
                                Retrieved context, not necessarily used in the
                                answer. Valid references do not guarantee
                                correct interpretation.
                              </p>
                              <AnswerSources
                                sources={turn.answer.consultedSources}
                                onSelect={setSelectedCitation}
                              />
                            </details>
                          )}
                          <CopyAnswer content={turn.answer.answer} />
                        </>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
        {showJumpToLatest && turns.length > 0 && (
          <button
            type="button"
            onClick={jumpToLatest}
            className="absolute right-4 bottom-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 shadow-lg hover:bg-zinc-700"
          >
            <ArrowDown className="size-3.5" aria-hidden="true" />
            Latest message
          </button>
        )}
      </div>
      <form
        className="shrink-0 border-t border-white/10 bg-zinc-900 p-3 sm:px-6 sm:py-4 [@media(max-height:600px)]:py-2"
        onSubmit={handleSubmit}
      >
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border border-white/15 bg-black/20 p-2 focus-within:border-blue-400/40">
          <label className="sr-only" htmlFor="repository-question">
            Question about the repository
          </label>
          <textarea
            id="repository-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                submit(question);
              }
            }}
            placeholder="Ask a question about the codebase…"
            rows={2}
            maxLength={2_000}
            disabled={!ready || isLoading}
            required
            className="max-h-32 min-h-12 min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-base leading-6 text-zinc-100 outline-none placeholder:text-zinc-500 disabled:opacity-50 sm:text-sm [@media(max-height:600px)]:h-10 [@media(max-height:600px)]:min-h-10"
          />
          <Button
            type="submit"
            size="icon-lg"
            className="mb-0.5 bg-blue-600 text-white hover:bg-blue-500"
            disabled={!ready || isLoading || question.trim().length < 2}
            aria-label="Ask question"
          >
            {isLoading ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Send aria-hidden="true" />
            )}
          </Button>
        </div>
        <p className="mx-auto mt-2 hidden max-w-3xl text-center text-xs text-zinc-400 sm:block [@media(max-height:600px)]:hidden">
          Enter to send · Shift + Enter for a new line · Check important claims
          against the source
        </p>
      </form>
      {selectedCitation && (
        <SourceCodeDialog
          key={`${selectedCitation.chunkId}:${selectedCitation.startLine}`}
          repositoryId={repositoryId}
          citation={selectedCitation}
          onClose={() => setSelectedCitation(undefined)}
        />
      )}
    </section>
  );
}
