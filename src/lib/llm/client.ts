import OpenAI from "openai";

import { getEnvironment } from "@/config/env";

let client: OpenAI | undefined;

export function getOpenAiClient(): OpenAI {
  client ??= new OpenAI({
    apiKey: getEnvironment().OPENAI_API_KEY,
    timeout: 60_000,
    maxRetries: 1,
  });
  return client;
}
