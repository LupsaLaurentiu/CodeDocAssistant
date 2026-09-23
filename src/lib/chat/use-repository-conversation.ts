"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  answerSchema,
  buildConversationHistory,
  conversationKey,
  MAX_SAVED_TURNS,
  restoreConversation,
  serializeConversation,
  type ChatTurn,
} from "./conversation";

function responseError(payload: unknown) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error.slice(0, 2_000);
  }
  return "The question could not be answered. Please try again.";
}

export function useRepositoryConversation(
  repositoryId: string,
  indexRevision: string,
) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [ready, setReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [storageError, setStorageError] = useState<string>();
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        const saved = restoreConversation(
          localStorage.getItem(conversationKey(repositoryId)),
          indexRevision,
        );
        setTurns(saved.turns);
        setNotice(saved.notice);
      } catch {
        setStorageError(
          "Browser storage is unavailable. This conversation will not survive a refresh.",
        );
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
      activeRequest.current?.abort();
    };
  }, [repositoryId, indexRevision]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        localStorage.setItem(
          conversationKey(repositoryId),
          serializeConversation(turns, indexRevision),
        );
        setStorageError(undefined);
      } catch {
        setStorageError(
          "History could not be saved (browser storage may be full or disabled). Keep this tab open or copy important answers.",
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [indexRevision, ready, repositoryId, turns]);

  const execute = useCallback(
    async (turn: ChatTurn) => {
      const controller = new AbortController();
      activeRequest.current = controller;
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/repositories/${repositoryId}/questions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: turn.question,
              history: turn.history,
            }),
            signal: controller.signal,
          },
        );
        const payload: unknown = await response.json();
        if (!response.ok) throw new Error(responseError(payload));
        const result = answerSchema.safeParse(
          typeof payload === "object" && payload !== null && "result" in payload
            ? payload.result
            : undefined,
        );
        if (!result.success)
          throw new Error(
            "The server returned an invalid answer. Please try again.",
          );
        setTurns((current) =>
          current.map((item) =>
            item.id === turn.id
              ? {
                  ...item,
                  status: "answered",
                  answer: result.data,
                  error: undefined,
                }
              : item,
          ),
        );
      } catch (error) {
        if (controller.signal.aborted) return;
        setTurns((current) =>
          current.map((item) =>
            item.id === turn.id
              ? {
                  ...item,
                  status: "failed",
                  error:
                    error instanceof Error
                      ? error.message.slice(0, 2_000)
                      : "The question failed. Please try again.",
                }
              : item,
          ),
        );
      } finally {
        if (!controller.signal.aborted) {
          activeRequest.current = null;
          setIsLoading(false);
        }
      }
    },
    [repositoryId],
  );

  function ask(question: string) {
    const normalized = question.trim();
    if (
      !ready ||
      activeRequest.current ||
      normalized.length < 2 ||
      normalized.length > 2_000
    )
      return false;
    const turn: ChatTurn = {
      id: crypto.randomUUID(),
      question: normalized,
      history: buildConversationHistory(turns),
      status: "pending",
    };
    setTurns((current) => [...current, turn].slice(-MAX_SAVED_TURNS));
    void execute(turn);
    return true;
  }

  function retry(id: string) {
    const turn = turns.find((item) => item.id === id);
    if (!ready || activeRequest.current || !turn || turn.status !== "failed")
      return;
    setTurns((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, status: "pending", error: undefined }
          : item,
      ),
    );
    // Reuse the original question and history snapshot, never the failed request.
    void execute(turn);
  }

  function clear() {
    if (
      activeRequest.current ||
      !window.confirm(
        "Start a new conversation? The saved conversation for this repository will be removed from this browser.",
      )
    )
      return;
    setTurns([]);
    setNotice(undefined);
  }

  return { turns, ready, isLoading, notice, storageError, ask, retry, clear };
}
