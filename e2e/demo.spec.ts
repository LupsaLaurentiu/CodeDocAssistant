import path from "node:path";
import { mkdir, rename } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { ask, mockAnswer, repositoryId } from "./fixtures";

test("capture a clearly labelled, deterministic UX walkthrough", async ({
  browser,
  baseURL,
}) => {
  test.skip(
    process.env.CAPTURE_DEMO !== "1",
    "Opt-in artifact generation; no paid provider calls.",
  );
  const screenshots = path.resolve("docs/screenshots");
  const videos = path.resolve("docs/demo");
  await mkdir(screenshots, { recursive: true });
  await mkdir(videos, { recursive: true });
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: videos, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  // Add the label after hydration; it is an artifact annotation, not product UI.
  async function showDemoLabel() {
    await page.evaluate(() => {
      const label = document.createElement("div");
      label.textContent = "SCRIPTED UX DEMO · TEST FIXTURE · NO LIVE LLM CALLS";
      Object.assign(label.style, {
        position: "fixed",
        bottom: "4px",
        left: "8px",
        zIndex: "2147483647",
        padding: "5px 10px",
        background: "#172554",
        color: "#bfdbfe",
        borderRadius: "5px",
        fontSize: "11px",
        fontFamily: "sans-serif",
        pointerEvents: "none",
      });
      document.body.append(label);
    });
  }
  await mockAnswer(page);
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Open tiny-service", exact: true }),
  ).toBeVisible();
  await showDemoLabel();
  await page.waitForTimeout(1_500);
  await page.screenshot({
    path: path.join(screenshots, "home.png"),
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Open tiny-service", exact: true })
    .click();
  await expect(page.getByLabel("Question about the repository")).toBeEnabled();
  await ask(page);
  await expect(
    page.getByRole("heading", { name: "Authentication", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(1_500);
  await page.screenshot({ path: path.join(screenshots, "workspace.png") });
  await page
    .getByRole("button", { name: "src/auth.ts:1-3", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("region", { name: "Source code", exact: true }),
  ).toContainText("validateSession");
  await page.waitForTimeout(1_500);
  await page.screenshot({ path: path.join(screenshots, "source-preview.png") });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1_500);
  await page.screenshot({
    path: path.join(screenshots, "mobile.png"),
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Authentication", exact: true }),
  ).toBeVisible();
  expect(page.url()).toContain(repositoryId);
  await showDemoLabel();
  expect(pageErrors).toEqual([]);
  const video = page.video();
  await context.close();
  if (video)
    await rename(await video.path(), path.join(videos, "ux-walkthrough.webm"));
});
