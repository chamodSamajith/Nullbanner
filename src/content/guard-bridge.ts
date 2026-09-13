// SPDX-License-Identifier: GPL-3.0-only

/**
 * Isolated-world content script (the default world). Runs at document_start,
 * alongside guard-main.ts (which runs in the page's MAIN world — see
 * manifest.config.ts). This script is the only one of the pair with access
 * to chrome.storage; it reads the on/off state and relays it to guard-main
 * via window.postMessage, since MAIN-world scripts cannot call chrome.* APIs
 * directly.
 *
 * Why two scripts instead of one: Chrome's isolated content-script world has
 * its own global object, so a `window.open` override written there is not
 * visible to the page's own scripts — only a script declared with
 * `"world": "MAIN"` runs in the page's actual JS context. See guard-main.ts.
 */
import { getStorage } from "../shared/storage";
import { GUARD_MESSAGE_SOURCE, type GuardBridgeMessage } from "./guard-protocol";

async function relayGuardState(): Promise<void> {
  const hostname = location.hostname;
  const storage = await getStorage();
  const armed = storage.globalEnabled && !storage.siteAllowlist.includes(hostname);

  const message: GuardBridgeMessage = { source: GUARD_MESSAGE_SOURCE, armed };
  window.postMessage(message, "*");
}

void relayGuardState();
