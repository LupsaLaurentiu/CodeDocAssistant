import { describe, expect, it } from "vitest";
import {
  buildConversationHistory,
  restoreConversation,
  serializeConversation,
  MAX_STORAGE_CHARACTERS,
  type ChatTurn,
} from "@/lib/chat/conversation";
const makeTurn = (status: ChatTurn["status"] = "answered"): ChatTurn => ({
  id: crypto.randomUUID(),
  question: "How does auth work?",
  history: [],
  status,
  answer:
    status === "answered"
      ? {
          answer: "Source-grounded answer",
          citations: [],
          consultedSources: [],
          grounding: "insufficient",
          retrievedChunks: 0,
        }
      : undefined,
});
describe("browser conversation persistence", () => {
  it("roundtrips a repository revision", () => {
    const turns = [makeTurn()];
    expect(
      restoreConversation(serializeConversation(turns, "rev1"), "rev1").turns,
    ).toEqual(turns);
  });
  it("excludes failed/pending turns from API context", () =>
    expect(
      buildConversationHistory([makeTurn("failed"), makeTurn("pending")]),
    ).toEqual([]));
  it("limits history to six messages and truncates long answers", () => {
    const turns = Array.from({ length: 10 }, () => makeTurn());
    turns[9].answer!.answer = "a".repeat(20_000);
    const history = buildConversationHistory(turns);
    expect(history).toHaveLength(6);
    expect(history.at(-1)?.content).toHaveLength(8_000);
  });
  it("preserves the original retry history after refresh", () => {
    const turn = makeTurn("pending");
    turn.history = [{ role: "user", content: "Previous question" }];
    const restored = restoreConversation(
      serializeConversation([turn], "r"),
      "r",
    );
    expect(restored.turns[0].status).toBe("failed");
    expect(restored.turns[0].history).toEqual(turn.history);
  });
  it.each([
    "broken-json",
    '{"version":1}',
    "x".repeat(MAX_STORAGE_CHARACTERS + 1),
  ])("recovers safely from invalid/oversized storage", (raw) =>
    expect(restoreConversation(raw, "r").turns).toEqual([]),
  );
  it("invalidates stale citations on reindex", () =>
    expect(
      restoreConversation(serializeConversation([makeTurn()], "old"), "new")
        .turns,
    ).toEqual([]));
  it("bounds saved turns", () =>
    expect(
      restoreConversation(
        serializeConversation(
          Array.from({ length: 50 }, () => makeTurn()),
          "r",
        ),
        "r",
      ).turns,
    ).toHaveLength(30));
});
