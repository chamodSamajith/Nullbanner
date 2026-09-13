// SPDX-License-Identifier: GPL-3.0-only

/**
 * MAIN-world content script (see manifest.config.ts — declared with
 * "world": "MAIN"). Runs in the page's actual JS context, so overriding
 * window.open here affects the page's own scripts, not just this content
 * script's isolated scope.
 *
 * Scope of this guard, deliberately kept narrow and honest:
 * - It blocks window.open() outright — the mechanism behind the "click
 *   anywhere on the page and it opens a scam/ad site in a new tab" pattern
 *   (e.g. on streaming/piracy sites). This is the same blunt approach
 *   classic "block all pop-ups" extension features use: no attempt to
 *   distinguish a legitimate popup (e.g. an OAuth login window) from an
 *   abusive one, because that distinction isn't reliably automatable from a
 *   content script. If a legitimate site's popup breaks, disable protection
 *   for that one site in the Nullbanner popup.
 * - It does NOT intercept full-page redirects done via `location.href =`,
 *   `location.assign()`, meta-refresh, etc. Overriding the `location`
 *   binding itself is not a stable, well-documented capability across
 *   Chrome versions, so rather than guess at it, it's left out of this pass.
 *
 * Defaults to blocking (fail-closed) the instant it runs, before guard-
 * bridge.ts's async chrome.storage read resolves and messages this script
 * with the real on/off state — so there is never a gap where an abusive
 * page can slip a popup through before the real state is known.
 */
import { isGuardBridgeMessage } from "./guard-protocol";

const nativeOpen = window.open.bind(window);
let armed = true;

function blockedOpen(): null {
  return null;
}

function applyArmedState(next: boolean): void {
  armed = next;
  window.open = armed ? blockedOpen : nativeOpen;
}

applyArmedState(true);

window.addEventListener("message", (event) => {
  if (event.source !== window) return; // only trust same-page senders (our bridge script)
  if (!isGuardBridgeMessage(event.data)) return;
  applyArmedState(event.data.armed);
});
