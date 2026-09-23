import { generateAnswer } from "@/lib/llm/generate-answer";
import type { ConversationMessage, RepositoryAnswer } from "@/types/rag";

import { INSUFFICIENT_ANSWER, validateAnswerCitations } from "./citations";
import { logEvent } from "@/lib/observability";
import { selectContextChunks } from "./context";
import { createEmbeddings } from "./embeddings";
import { retrieveRelevantChunks } from "./retrieval";

function buildRetrievalQuery(
  question: string,
  history: ConversationMessage[],
): string {
  const recentUserQuestions = history
    .filter((message) => message.role === "user")
    .slice(-2)
    .map((message) => message.content);

  return [...recentUserQuestions, question].join("\n");
}

export async function answerRepositoryQuestion(input: {
  repositoryId: string;
  question: string;
  history?: ConversationMessage[];
}): Promise<RepositoryAnswer> {
  const history = input.history ?? [];
  const started = performance.now();
  const retrievalQuery = buildRetrievalQuery(input.question, history);
  const [queryEmbedding] = await createEmbeddings([retrievalQuery]);
  if (!queryEmbedding) {
    throw new Error("Could not create an embedding for the question.");
  }

  const retrieved = await retrieveRelevantChunks({
    repositoryId: input.repositoryId,
    queryEmbedding,
    limit: 8,
  });
  const contextChunks = selectContextChunks(retrieved);

  if (contextChunks.length === 0) {
    return {
      answer: INSUFFICIENT_ANSWER,
      citations: [],
      consultedSources: [],
      grounding: "insufficient",
      retrievedChunks: retrieved.length,
    };
  }

  const generated = await generateAnswer(
    input.question,
    contextChunks,
    history,
  );
  const answer = validateAnswerCitations(generated, contextChunks);
  logEvent("rag.answer", {
    repositoryId: input.repositoryId,
    durationMs: Math.round(performance.now() - started),
    retrievedChunks: retrieved.length,
    citedSources: answer.citations.length,
    grounding: answer.grounding,
  });
  return {
    ...answer,
    retrievedChunks: retrieved.length,
  };
}
