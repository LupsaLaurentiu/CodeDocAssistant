import { generateAnswer } from "@/lib/llm/generate-answer";
import type {
  ConversationMessage,
  RepositoryAnswer,
  SourceCitation,
} from "@/types/rag";

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

function buildCitations(
  chunks: ReturnType<typeof selectContextChunks>,
): SourceCitation[] {
  const seen = new Set<string>();

  return chunks.flatMap((chunk) => {
    const key = `${chunk.filePath}:${chunk.startLine}-${chunk.endLine}`;
    if (seen.has(key)) {
      return [];
    }
    seen.add(key);
    return [
      {
        chunkId: chunk.id,
        filePath: chunk.filePath,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
      },
    ];
  });
}

export async function answerRepositoryQuestion(input: {
  repositoryId: string;
  question: string;
  history?: ConversationMessage[];
}): Promise<RepositoryAnswer> {
  const history = input.history ?? [];
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
      answer:
        "I could not find relevant indexed source code for this question.",
      citations: [],
      retrievedChunks: 0,
    };
  }

  const answer = await generateAnswer(input.question, contextChunks, history);
  return {
    answer,
    citations: buildCitations(contextChunks),
    retrievedChunks: retrieved.length,
  };
}
