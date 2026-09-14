// SPDX-License-Identifier: GPL-3.0-only

/**
 * Isolated-world content script (the default world), paired with
 * guard-main.ts which runs in the page's MAIN world. This is the only one
 * of the pair that can call chrome.* APIs, so it owns two jobs:
 *
 * 1. Read the global/per-site on-off state from chrome.storage and relay it
 *    to guard-main via window.postMessage, authenticated with a nonce that
 *    is handed over through a DOM attribute before any page script runs
 *    (see guard-protocol.ts for why).
 *
 * 2. Block the *other* common new-tab hijack: the page creates an
 *    <a target="_blank" href="https://scam.example"> and calls .click() on
 *    it from inside a real click handler. That never touches window.open,
 *    so guard-main can't see it — but this listener can, and because it
 *    lives in the isolated world the page can neither find nor remove it.
 *    Only *synthetic* (event.isTrusted === false) clicks on links that lead
 *    off the current site are cancelled; a real user click on a real link
 *    is never touched.
 */
import { getStorage } from "../shared/storage";
import {
  GUARD_MESSAGE_SOURCE,
  GUARD_NONCE_ATTR,
  type GuardBridgeMessage
} from "./guard-protocol";

// Fail-closed until storage answers, mirroring guard-main.
let armed = true;

// --- 1. nonce handoff + state relay ----------------------------------------
const nonce = crypto.randomUUID();
document.documentElement.setAttribute(GUARD_NONCE_ATTR, nonce);

void (async () => {
  const storage = await getStorage();
  armed = storage.globalEnabled && !storage.siteAllowlist.includes(location.hostname);
  const message: GuardBridgeMessage = { source: GUARD_MESSAGE_SOURCE, nonce, armed };
  window.postMessage(message, "*");
})();

// --- 2. synthetic cross-site link clicks -----------------------------------
function leavesThisSite(anchor: HTMLAnchorElement): boolean {
  try {
    return new URL(anchor.href, location.href).host !== location.host;
  } catch {
    return false;
  }
}

document.addEventListener(
  "click",
  (event) => {
    if (!armed || event.isTrusted) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest("a[href]");
    if (!(anchor instanceof HTMLAnchorElement)) return;
    const opensNewContext = anchor.target === "_blank" || anchor.target === "_new";
    if (opensNewContext && leavesThisSite(anchor)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },
  true // capture: runs before the page's own handlers
);
