import { getEnvironment } from "@/config/env";

export function getAiConfig() {
  const env = getEnvironment();

  return {
    chatModel: env.OPENAI_CHAT_MODEL,
    embeddingModel: env.OPENAI_EMBEDDING_MODEL,
    embeddingDimensions: 1536,
  } as const;
}
