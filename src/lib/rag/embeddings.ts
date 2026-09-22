import { getAiConfig } from "@/config/ai";
import { getOpenAiClient } from "@/lib/llm/client";

const EMBEDDING_BATCH_SIZE = 32;

export async function createEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const config = getAiConfig();
  const embeddings: number[][] = [];

  for (let offset = 0; offset < texts.length; offset += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(offset, offset + EMBEDDING_BATCH_SIZE);
    const response = await getOpenAiClient().embeddings.create({
      model: config.embeddingModel,
      input: batch,
      encoding_format: "float",
    });

    const ordered = response.data.toSorted(
      (left, right) => left.index - right.index,
    );
    if (ordered.length !== batch.length) {
      throw new Error("OpenAI returned an unexpected number of embeddings.");
    }

    for (const item of ordered) {
      if (item.embedding.length !== config.embeddingDimensions) {
        throw new Error(
          `Embedding dimension mismatch: expected ${config.embeddingDimensions}, received ${item.embedding.length}.`,
        );
      }
      embeddings.push(item.embedding);
    }
  }

  return embeddings;
}
