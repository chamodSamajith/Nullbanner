// SPDX-License-Identifier: GPL-3.0-only

/**
 * MAIN-world content script (declared with "world": "MAIN" in
 * manifest.config.ts). Runs in the page's own JS context, so overriding
 * window.open here affects the page's scripts — an override written from
 * the isolated world would only be visible to the content script itself.
 *
 * What it does:
 * - Replaces window.open with a stub that returns null, exactly as Chrome's
 *   built-in popup blocker does. (`open` is an own property of the window
 *   instance in Chrome, not on Window.prototype, so there is no prototype
 *   path to guard separately.)
 * - Stubs `open` on same-origin child windows the moment the page obtains
 *   them (via iframe.contentWindow or document.defaultView). Chrome injects
 *   content scripts into a freshly created about:blank iframe *after* the
 *   current task, so `appendChild(f); f.contentWindow.open(…)` would
 *   otherwise slip through — the classic popunder trick. (`window.frames[i]`
 *   index access is a plain property lookup and cannot be hooked; that path
 *   is only covered once the child's own copy of this script has run.)
 * - Starts armed (fail-closed) the instant it runs, then applies the real
 *   on/off state once guard-bridge.ts reads chrome.storage and reports it.
 * - Only honours a disarm message that carries the nonce minted by the
 *   bridge (see guard-protocol.ts), so a page can't forge one.
 *
 * What it deliberately does NOT do: intercept `location.href = …` style
 * same-tab redirects. Overriding the `location` binding isn't a stable,
 * documented capability, so that stays out of scope rather than guessed at.
 * Synthetic-click hijacks (`a.click()` on a generated target=_blank link)
 * are handled in guard-bridge.ts, where the page can't see the listener.
 */
import { GUARD_NONCE_ATTR, isGuardBridgeMessage } from "./guard-protocol";

const nativeOpen = window.open;
let armed = true;

function blockedOpen(): null {
  return null;
}

function applyArmedState(next: boolean): void {
  armed = next;
  window.open = armed ? blockedOpen : nativeOpen;
}

applyArmedState(true);

// --- child windows obtained by the page ------------------------------------
function guardChildWindow(child: Window | null): Window | null {
  if (child && armed) {
    try {
      if (child.open !== blockedOpen) child.open = blockedOpen;
    } catch {
      // cross-origin child: not ours to touch, and it can't inherit our
      // user activation for a popup anyway.
    }
  }
  return child;
}

function hookWindowGetter(proto: object, prop: string): void {
  const desc = Object.getOwnPropertyDescriptor(proto, prop);
  if (!desc?.get || !desc.configurable) return;
  const nativeGet = desc.get;
  Object.defineProperty(proto, prop, {
    ...desc,
    get(this: unknown) {
      return guardChildWindow(nativeGet.call(this) as Window | null);
    }
  });
}

hookWindowGetter(HTMLIFrameElement.prototype, "contentWindow");
hookWindowGetter(HTMLFrameElement.prototype, "contentWindow");
hookWindowGetter(Document.prototype, "defaultView");

// --- one-time nonce handoff from the bridge -------------------------------
// Both scripts run at document_start, but in no guaranteed order. If the
// bridge already wrote the attribute, take it now; otherwise watch for it.
// The MutationObserver callback is a microtask, so it fires as soon as the
// bridge's script finishes — still before the parser hands control to any
// page script — and the attribute is gone before the page can read it.
let nonce: string | null = null;
const root = document.documentElement;

function takeNonce(): void {
  const value = root.getAttribute(GUARD_NONCE_ATTR);
  if (value === null) return;
  root.removeAttribute(GUARD_NONCE_ATTR);
  if (nonce === null) nonce = value;
}

takeNonce();
if (nonce === null) {
  const observer = new MutationObserver(() => {
    takeNonce();
    if (nonce !== null) observer.disconnect();
  });
  observer.observe(root, { attributes: true, attributeFilter: [GUARD_NONCE_ATTR] });
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (!isGuardBridgeMessage(event.data)) return;
  if (nonce === null || event.data.nonce !== nonce) return; // forged or premature
  applyArmedState(event.data.armed);
});
