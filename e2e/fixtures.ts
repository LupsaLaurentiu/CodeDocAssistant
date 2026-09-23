import type { Page } from "@playwright/test";
export const repositoryId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
export const chunkId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
export const question = "How does authentication work?";
export const response = {
  answer:
    "### Authentication\n\nThe login function delegates session validation to a helper. The retrieved excerpt does not show the helper implementation.\n\nSources: `src/auth.ts:1-3`",
  citations: [{ chunkId, filePath: "src/auth.ts", startLine: 1, endLine: 3 }],
  consultedSources: [
    { chunkId, filePath: "src/auth.ts", startLine: 1, endLine: 3 },
  ],
  retrievedChunks: 1,
  grounding: "verified",
};
export async function mockAnswer(page: Page, answer = response) {
  await page.route("**/api/repositories/*/questions", (route) =>
    route.fulfill({ json: { result: answer } }),
  );
}
export async function ask(page: Page) {
  await page.getByLabel("Question about the repository").fill(question);
  await page.getByRole("button", { name: "Ask question", exact: true }).click();
}
