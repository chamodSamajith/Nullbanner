// SPDX-License-Identifier: GPL-3.0-only
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect, chromium, type BrowserContext } from "@playwright/test";
import { startFixtureServer } from "./server";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(dirname, "../../dist");
const PORT = 8934;

let context: BrowserContext;
let server: Awaited<ReturnType<typeof startFixtureServer>>;

test.beforeAll(async () => {
  server = await startFixtureServer(PORT);
  context = await chromium.launchPersistentContext("", {
    headless: false, // MV3 extensions require a headed/new-headless context
    args: [`--disable-extensions-except=${distPath}`, `--load-extension=${distPath}`]
  });
});

test.afterAll(async () => {
  await context.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("blocks a fixture request matching the test ruleset", async () => {
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/`);
  await expect(page.locator("#result")).toHaveText("blocked", { timeout: 5000 });
});

test("popup loads and resolves status without hanging on 'Loading…'", async () => {
  // Opening the popup as a plain tab (rather than via the toolbar action)
  // means chrome.tabs.query({active:true}) sees the popup's own
  // chrome-extension:// URL, not a real site — this exercises the no-valid-
  // hostname fallback path rather than the real-site path (covered by the
  // background unit tests instead).
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent("serviceworker");
  const extensionId = worker.url().split("/")[2];

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  await expect(page.getByText("Loading…")).toHaveCount(0, { timeout: 5000 });
  await expect(page.getByText("No site loaded")).toBeVisible();
});
