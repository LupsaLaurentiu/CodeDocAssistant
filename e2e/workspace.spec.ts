import { test, expect } from "@playwright/test";
import {
  ask,
  chunkId,
  mockAnswer,
  question,
  repositoryId,
  response,
} from "./fixtures";

test("recent repositories reopen an existing index without analysis", async ({
  page,
}) => {
  let analysisCalls = 0;
  await page.route("**/api/repositories/analyze", (route) => {
    analysisCalls++;
    return route.fulfill({
      status: 500,
      json: { error: "Unexpected analysis" },
    });
  });
  await page.goto("/");
  await page
    .getByRole("link", { name: "Open tiny-service", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ask tiny-service" }),
  ).toBeVisible();
  expect(analysisCalls).toBe(0);
});

test("retry preserves original request, sources open, copy works, reload keeps history", async ({
  page,
  context,
}) => {
  const requests: unknown[] = [];
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.route("**/api/repositories/*/questions", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill(
      requests.length === 1
        ? {
            status: 503,
            json: { error: "Temporary test failure. Retry safely." },
          }
        : { json: { result: response } },
    );
  });
  await page.goto(`/repositories/${repositoryId}`);
  await expect(page.getByLabel("Question about the repository")).toBeEnabled();
  await ask(page);
  await page.getByRole("button", { name: "Retry question" }).click();
  await expect(
    page.getByRole("heading", { name: "Authentication", exact: true }),
  ).toBeVisible();
  expect(requests).toEqual([
    { question, history: [] },
    { question, history: [] },
  ]);
  await expect(page.getByText(question, { exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Copy answer" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Copied" }),
  ).toBeVisible();
  expect(
    (await page.evaluate(() => navigator.clipboard.readText())).replaceAll(
      "\r\n",
      "\n",
    ),
  ).toBe(response.answer);
  await page
    .getByRole("button", { name: "src/auth.ts:1-3", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Source code", exact: true }),
  ).toContainText("validateSession");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Authentication", exact: true }),
  ).toBeVisible();
  expect(requests).toHaveLength(2);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "New conversation" }).click();
  await expect(
    page.getByRole("heading", { name: "Authentication", exact: true }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "New conversation" }).click();
  await expect(
    page.getByRole("heading", { name: "Explore this codebase" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Explore this codebase" }),
  ).toBeVisible();
});

test("real progress counters and analysis retry are visible", async ({
  page,
}) => {
  let phase = "CLONING";
  let finish: (() => void) | undefined;
  await page.route("**/api/repositories/status?*", (route) =>
    route.fulfill({
      json: {
        result: {
          repositoryId,
          status: "INDEXING",
          phase,
          filesDiscovered: 12,
          filesProcessed: 12,
          filesSkipped: 0,
          chunksTotal: 20,
          chunksEmbedded: 8,
          error: null,
          commitSha: null,
          indexReused: false,
          updatedAt: new Date().toISOString(),
        },
      },
    }),
  );
  let count = 0;
  await page.route("**/api/repositories/analyze", async (route) => {
    count++;
    if (count === 1) {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      await route.fulfill({
        status: 500,
        json: { error: "Test analysis interruption. Please retry." },
      });
    } else
      await route.fulfill({
        json: {
          result: {
            repositoryId,
            repositoryUrl: "https://github.com/codedoc-fixtures/tiny-service",
            filesDiscovered: 12,
            filesIndexed: 12,
            filesSkipped: 0,
            chunksIndexed: 20,
            indexReused: true,
          },
        },
      });
  });
  await page.goto("/");
  await page
    .getByLabel("GitHub repository URL")
    .fill("https://github.com/codedoc-fixtures/tiny-service");
  await page
    .getByRole("button", { name: "Analyze Repository", exact: true })
    .click();
  await expect(
    page.getByText("Cloning repository", { exact: true }),
  ).toBeVisible();
  phase = "EMBEDDING";
  await expect(page.getByText("Chunks embedded: 8/20")).toBeVisible({
    timeout: 10_000,
  });
  finish?.();
  await expect(
    page.getByRole("alert").filter({ hasText: "Test analysis interruption" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Retry analysis", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(repositoryId));
});

test("long answers keep the composer visible across desktop and mobile sizes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mockAnswer(page, {
    ...response,
    answer: Array(25).fill(response.answer).join("\n\n"),
  });
  await page.goto(`/repositories/${repositoryId}`);
  await expect(page.getByLabel("Question about the repository")).toBeEnabled();
  await ask(page);
  await expect(page.getByRole("button", { name: "Copy answer" })).toBeVisible();
  for (const size of [
    { width: 1440, height: 900 },
    { width: 1280, height: 600 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    const dimensions = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      height: innerHeight,
      width: innerWidth,
    }));
    expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.height + 1);
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
    const composer = await page
      .getByLabel("Question about the repository")
      .boundingBox();
    expect(composer).not.toBeNull();
    expect(composer!.y + composer!.height).toBeLessThanOrEqual(size.height);
  }
  expect(errors).toEqual([]);
});

test("source endpoint is repository-scoped", async ({ request }) => {
  const wrong = await request.get(
    `/api/repositories/11111111-1111-4111-8111-111111111111/chunks/${chunkId}`,
  );
  expect(wrong.status()).toBe(404);
});
