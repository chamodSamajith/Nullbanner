// SPDX-License-Identifier: GPL-3.0-only

/**
 * Typed wrapper over chrome.runtime messaging. Every message the popup/
 * options pages exchange with the background service worker is declared
 * here as part of the discriminated union — no ad-hoc string message types
 * elsewhere in the codebase.
 */
export type Message =
  | { type: "GET_STATUS"; hostname: string }
  | { type: "TOGGLE_SITE"; hostname: string }
  | { type: "TOGGLE_GLOBAL" };

export interface StatusResponse {
  globalEnabled: boolean;
  siteDisabled: boolean;
  version: string;
}

export type Response = StatusResponse | { ok: true } | { error: string };

export function sendMessage<T extends Response = Response>(message: Message): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

export function onMessage(
  handler: (message: Message, sender: chrome.runtime.MessageSender) => Promise<Response> | Response | void
): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const result = handler(message as Message, sender);
    if (result instanceof Promise) {
      result.then((value) => sendResponse(value));
      return true; // keep channel open for async response
    }
    if (result !== undefined) {
      sendResponse(result);
    }
    return false;
  });
}
