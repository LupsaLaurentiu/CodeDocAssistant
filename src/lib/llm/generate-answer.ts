import { getAiConfig } from "@/config/ai";
import type { ConversationMessage, RetrievedChunk } from "@/types/rag";

import { buildRagContext } from "../rag/context";
import { getOpenAiClient } from "./client";
import { CODE_ASSISTANT_SYSTEM_PROMPT } from "./prompts";

export async function generateAnswer(
  question: string,
  chunks: RetrievedChunk[],
  history: ConversationMessage[] = [],
): Promise<string> {
  const conversationHistory = history
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");
  const response = await getOpenAiClient().responses.create({
    model: getAiConfig().chatModel,
    instructions: CODE_ASSISTANT_SYSTEM_PROMPT,
    input: `<conversation_history>\n${conversationHistory || "No previous messages."}\n</conversation_history>\n\n<repository_context>\n${buildRagContext(chunks)}\n</repository_context>\n\n<current_question>\n${question}\n</current_question>`,
    max_output_tokens: 1_500,
    store: false,
  });

  const answer = response.output_text.trim();
  if (!answer) {
    throw new Error("OpenAI returned an empty answer.");
  }

  return answer;
}
