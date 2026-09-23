import type { RetrievedChunk } from "@/types/rag";
export const chunk: RetrievedChunk = {
  id: "11111111-1111-4111-8111-111111111111",
  filePath: "src/auth.ts",
  language: "typescript",
  startLine: 10,
  endLine: 12,
  content: "export function login() {\n  return validateSession();\n}",
  score: 0.8,
};
