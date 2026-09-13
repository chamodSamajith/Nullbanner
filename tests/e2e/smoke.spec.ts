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

test("popup guard blocks a window.open hijack triggered by a page click", async () => {
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/popup-hijack.html`);
  await page.click("body");
  await expect(page.locator("#result")).toHaveText("blocked", { timeout: 5000 });
});

test("disabling protection for a hostname lets window.open through again", async () => {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent("serviceworker");
  const extensionId = worker.url().split("/")[2];

  // Drive this through the same storage key src/shared/storage.ts reads/
  // writes, rather than simulating real tab-focus switching (which the
  // popup's chrome.tabs.query({active:true}) call doesn't tolerate well in
  // this harness — see the "No site loaded" test above).
  const settingsPage = await context.newPage();
  await settingsPage.goto(`chrome-extension://${extensionId}/src/options/index.html`);
  await settingsPage.evaluate(
    () =>
      new Promise<void>((resolve) => {
        chrome.storage.local.set(
          { nullbanner: { schemaVersion: 1, globalEnabled: true, siteAllowlist: ["localhost"] } },
          () => resolve()
        );
      })
  );
  await settingsPage.close();

  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/popup-hijack.html`);
  await page.click("body");
  await expect(page.locator("#result")).toHaveText("opened", { timeout: 5000 });
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
