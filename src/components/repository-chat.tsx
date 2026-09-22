"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDown,
  Bot,
  FileCode2,
  LoaderCircle,
  Send,
  Sparkles,
  User,
} from "lucide-react";
import { MarkdownAnswer } from "@/components/markdown-answer";
import { Button } from "@/components/ui/button";
import { SourceCodeDialog } from "@/components/source-code-dialog";
import type {
  ConversationMessage,
  RepositoryAnswer,
  SourceCitation,
} from "@/types/rag";

interface DisplayMessage extends ConversationMessage {
  id: string;
  citations?: SourceCitation[];
  isError?: boolean;
}

const SUGGESTED_QUESTIONS = [
  "Explain the architecture of this repository.",
  "What API endpoints exist?",
  "How does data flow through the application?",
  "Which external dependencies are important?",
];

const MAX_HISTORY_MESSAGE_CHARACTERS = 8_000;

function isCitation(value: unknown): value is SourceCitation {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.chunkId === "string" &&
    typeof candidate.filePath === "string" &&
    typeof candidate.startLine === "number" &&
    typeof candidate.endLine === "number"
  );
}

function isRepositoryAnswer(value: unknown): value is RepositoryAnswer {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.answer === "string" &&
    typeof candidate.retrievedChunks === "number" &&
    Array.isArray(candidate.citations) &&
    candidate.citations.every(isCitation)
  );
}

function getResponseError(payload: unknown): string {
  if (typeof payload === "object" && payload !== null) {
    const error = (payload as Record<string, unknown>).error;
    if (typeof error === "string") return error;
  }
  return "The question could not be answered. Check the server logs.";
}

export function RepositoryChat({
  repositoryId,
  repositoryName,
}: {
  repositoryId: string;
  repositoryName: string;
}) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<SourceCitation>();
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const messagesViewportRef = useRef<HTMLDivElement>(null);
  const latestMessageRef = useRef<HTMLElement>(null);
  const followNewMessagesRef = useRef(true);

  useEffect(() => {
    const viewport = messagesViewportRef.current;
    const latestMessage = latestMessageRef.current;
    if (!viewport || !latestMessage || !followNewMessagesRef.current) return;

    // Scroll only the conversation. Keep the beginning of a long answer readable.
    const top =
      messages.at(-1)?.role === "assistant"
        ? viewport.scrollTop +
          latestMessage.getBoundingClientRect().top -
          viewport.getBoundingClientRect().top -
          24
        : viewport.scrollHeight;
    viewport.scrollTo({ top: Math.max(0, top), behavior: "instant" });
  }, [messages]);

  function jumpToLatest() {
    const viewport = messagesViewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }

  async function askQuestion(questionText: string) {
    const normalizedQuestion = questionText.trim();
    if (normalizedQuestion.length < 2 || isLoading) return;

    const history = messages
      .filter((message) => !message.isError)
      .slice(-6)
      .map(({ role, content }): ConversationMessage => ({
        role,
        content: content.slice(0, MAX_HISTORY_MESSAGE_CHARACTERS),
      }));
    const userMessage: DisplayMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: normalizedQuestion,
    };

    followNewMessagesRef.current = true;
    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/repositories/${repositoryId}/questions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: normalizedQuestion, history }),
        },
      );
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(getResponseError(payload));

      const result =
        typeof payload === "object" && payload !== null
          ? (payload as Record<string, unknown>).result
          : undefined;
      if (!isRepositoryAnswer(result)) {
        throw new Error("The server returned an invalid answer.");
      }

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.answer,
          citations: result.citations,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "The question failed unexpectedly.",
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void askQuestion(question);
  }

  return (
    <section
      className="flex h-full min-h-0 flex-col"
      aria-label="Repository chat"
    >
      <header className="shrink-0 border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4 [@media(max-height:600px)]:py-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-blue-300" aria-hidden="true" />
          <h2 className="min-w-0 truncate text-sm font-medium text-zinc-100">
            Ask {repositoryName}
          </h2>
        </div>
        <p className="mt-1 hidden text-xs text-zinc-400 sm:block [@media(max-height:600px)]:hidden">
          Explore the code. Follow the sources.
        </p>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={messagesViewportRef}
          role="region"
          aria-label="Conversation"
          tabIndex={0}
          className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-400/50 sm:px-6 sm:py-7"
          onScroll={(event) => {
            const viewport = event.currentTarget;
            const nearBottom =
              viewport.scrollHeight -
                viewport.scrollTop -
                viewport.clientHeight <
              100;
            followNewMessagesRef.current = nearBottom;
            setShowJumpToLatest(!nearBottom);
          }}
        >
          {messages.length === 0 ? (
            <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center py-4 text-center">
              <span className="flex size-11 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-400/10">
                <Bot className="size-5 text-blue-300" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-zinc-100">
                Explore this codebase
              </h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">
                Ask about architecture, implementation details, dependencies,
                data flow, or where a feature lives.
              </p>
              <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
                {SUGGESTED_QUESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-left text-sm leading-6 text-zinc-300 transition-colors hover:border-blue-400/30 hover:bg-blue-400/5 hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-blue-400 disabled:opacity-50"
                    onClick={() => void askQuestion(suggestion)}
                    disabled={isLoading}
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
              {messages.map((message, index) => (
                <article
                  key={message.id}
                  ref={
                    index === messages.length - 1 ? latestMessageRef : undefined
                  }
                  className="flex items-start gap-2.5 sm:gap-4"
                >
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                    {message.role === "assistant" ? (
                      <Bot
                        className="size-4 text-blue-300"
                        aria-hidden="true"
                      />
                    ) : (
                      <User
                        className="size-4 text-zinc-400"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="mb-2 text-xs font-medium text-zinc-400">
                      {message.role === "assistant" ? "Assistant" : "You"}
                    </p>
                    {message.role === "assistant" && !message.isError ? (
                      <MarkdownAnswer content={message.content} />
                    ) : (
                      <p
                        role={message.isError ? "alert" : undefined}
                        className={`rounded-lg px-3 py-2.5 text-[15px] leading-7 wrap-anywhere whitespace-pre-wrap ${message.isError ? "border border-red-400/20 bg-red-400/5 text-red-300" : "bg-white/5 text-zinc-100"}`}
                      >
                        {message.content}
                      </p>
                    )}
                    {message.citations && message.citations.length > 0 && (
                      <div className="mt-4 border-t border-white/5 pt-3">
                        <p className="mb-2 text-xs font-medium tracking-wide text-zinc-400 uppercase">
                          Retrieved sources
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {message.citations.map((citation) => {
                            const label = `${citation.filePath}:${citation.startLine}-${citation.endLine}`;
                            return (
                              <button
                                key={citation.chunkId}
                                type="button"
                                className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-md border border-blue-400/20 bg-blue-400/10 px-2.5 py-1.5 font-mono text-xs text-blue-200 transition-colors hover:border-blue-400/40 hover:bg-blue-400/15 focus-visible:outline-2 focus-visible:outline-blue-400"
                                title={`Open ${label}`}
                                onClick={() => setSelectedCitation(citation)}
                              >
                                <FileCode2
                                  className="size-3 shrink-0"
                                  aria-hidden="true"
                                />
                                <span className="truncate">{label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              ))}
              {isLoading && (
                <div
                  className="flex items-center gap-2 pl-11 text-sm text-zinc-400"
                  role="status"
                >
                  <LoaderCircle
                    className="size-3.5 animate-spin"
                    aria-hidden="true"
                  />
                  Searching the repository and generating an answer…
                </div>
              )}
            </div>
          )}
        </div>
        {showJumpToLatest && messages.length > 0 && (
          <button
            type="button"
            onClick={jumpToLatest}
            className="absolute right-4 bottom-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 shadow-lg hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-blue-400 sm:right-6"
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
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border border-white/15 bg-black/20 p-2 focus-within:border-blue-400/40 focus-within:ring-2 focus-within:ring-blue-400/10">
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
                void askQuestion(question);
              }
            }}
            placeholder="Ask a question about the codebase…"
            rows={2}
            maxLength={2_000}
            disabled={isLoading}
            className="max-h-32 min-h-12 min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-base leading-6 text-zinc-100 outline-none placeholder:text-zinc-500 disabled:opacity-50 sm:text-sm [@media(max-height:600px)]:h-10 [@media(max-height:600px)]:min-h-10"
            required
          />
          <Button
            type="submit"
            size="icon-lg"
            className="mb-0.5 bg-blue-600 text-white hover:bg-blue-500"
            disabled={isLoading || question.trim().length < 2}
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
          Enter to send · Shift + Enter for a new line · Verify important
          details in the cited source
        </p>
      </form>

      {selectedCitation && (
        <SourceCodeDialog
          key={selectedCitation.chunkId}
          repositoryId={repositoryId}
          citation={selectedCitation}
          onClose={() => setSelectedCitation(undefined)}
        />
      )}
    </section>
  );
}
