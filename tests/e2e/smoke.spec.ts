// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable @typescript-eslint/no-explicit-any -- fixture hooks are untyped page globals */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect, chromium, type BrowserContext } from "@playwright/test";
import { startFixtureServer } from "./server";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(dirname, "../../dist");
const PORT = 8934;

let context: BrowserContext;
let server: Awaited<ReturnType<typeof startFixtureServer>>;

/** Number of new tabs/popups the browser opened while `action` ran. */
async function newPagesDuring(action: () => Promise<void>): Promise<number> {
  let count = 0;
  const onPage = () => count++;
  context.on("page", onPage);
  await action();
  await new Promise((r) => setTimeout(r, 600));
  context.off("page", onPage);
  return count;
}

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

test("ad-networks ruleset blocks a popunder loader by URL signature", async () => {
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/popunder-loader.html`);
  await expect(page.locator("#loader")).toHaveText("loader-blocked", { timeout: 5000 });
});

test("popup guard blocks a window.open hijack triggered by a page click", async () => {
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/popup-hijack.html`);
  await page.click("body");
  await expect(page.locator("#result")).toHaveText("blocked", { timeout: 5000 });
});

test("popup guard is installed synchronously before the first page script", async () => {
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/popup-hijack.html`);
  expect(await page.evaluate(() => (window as any).__guardAtLoad)).toBe("stubbed");
  expect(await page.evaluate(() => (window as any).__nonceVisibleAtLoad)).toBe(false);
  expect(
    await page.evaluate(() => document.documentElement.hasAttribute("data-nullbanner-guard"))
  ).toBe(false);
});

test("popup guard survives the usual bypass attempts", async () => {
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/popup-hijack.html`);
  expect(await page.evaluate(() => (window as any).tryBlankFrameOpen())).toBe("blocked");
  expect(await page.evaluate(() => (window as any).tryForgedDisarm())).toBe("blocked");
});

test("popup guard cancels a synthetic click on a generated cross-site target=_blank link", async () => {
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/popup-hijack.html`);
  // Real gesture, so only our guard (not Chrome's own blocker) can stop it.
  expect(await newPagesDuring(() => page.click("#hijack-link"))).toBe(0);
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
  // Wait for the popup that this click opens to register, so it can't bleed
  // into the count taken for the next action.
  const popup = context.waitForEvent("page");
  await page.click("body");
  await expect(page.locator("#result")).toHaveText("opened", { timeout: 5000 });
  await popup;

  expect(await newPagesDuring(() => page.click("#hijack-link"))).toBe(1);

  // Put storage back so later tests see default (armed) state.
  const reset = await context.newPage();
  await reset.goto(`chrome-extension://${extensionId}/src/options/index.html`);
  await reset.evaluate(
    () =>
      new Promise<void>((resolve) => {
        chrome.storage.local.set(
          { nullbanner: { schemaVersion: 1, globalEnabled: true, siteAllowlist: [] } },
          () => resolve()
        );
      })
  );
  await reset.close();
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
