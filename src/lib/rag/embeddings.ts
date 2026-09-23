import { getAiConfig } from "@/config/ai";
import { getOpenAiClient } from "@/lib/llm/client";
import { logEvent } from "@/lib/observability";
const EMBEDDING_BATCH_SIZE = 32;
interface EmbeddingProgress {
  completed: number;
  total: number;
  tokens: number | null;
}
export async function createEmbeddings(
  texts: string[],
  options: { onBatch?: (progress: EmbeddingProgress) => Promise<void> } = {},
): Promise<number[][]> {
  const config = getAiConfig();
  const embeddings: number[][] = [];
  for (let offset = 0; offset < texts.length; offset += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(offset, offset + EMBEDDING_BATCH_SIZE);
    const started = performance.now();
    const response = await getOpenAiClient().embeddings.create({
      model: config.embeddingModel,
      input: batch,
      encoding_format: "float",
      dimensions: config.embeddingDimensions,
    });
    const ordered = response.data.toSorted(
      (left, right) => left.index - right.index,
    );
    if (ordered.length !== batch.length)
      throw new Error("Unexpected embedding count.");
    for (const [index, item] of ordered.entries()) {
      if (
        item.index !== index ||
        item.embedding.length !== config.embeddingDimensions ||
        !item.embedding.every(Number.isFinite)
      )
        throw new Error("Invalid embedding dimensions, indices or values.");
      embeddings.push(item.embedding);
    }
    const tokens = response.usage?.total_tokens ?? null;
    logEvent("llm.embeddings", {
      model: config.embeddingModel,
      inputs: batch.length,
      tokens,
      durationMs: Math.round(performance.now() - started),
    });
    await options.onBatch?.({
      completed: embeddings.length,
      total: texts.length,
      tokens,
    });
  }
  return embeddings;
}
