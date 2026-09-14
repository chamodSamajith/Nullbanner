// SPDX-License-Identifier: GPL-3.0-only

/**
 * Shared contract between guard-bridge.ts (isolated world) and
 * guard-main.ts (MAIN world). Kept as plain data since it crosses a
 * postMessage boundary.
 *
 * Trust model: window.postMessage is readable AND writable by the page
 * itself, so a bare "disarm" message could be forged by any site to switch
 * the guard off. To prevent that, the bridge mints a random nonce and
 * hands it to guard-main through a DOM attribute that both scripts touch
 * at document_start — before any page script has run — and guard-main
 * deletes it the moment it reads it. The page never observes the nonce, so
 * it can't forge a message that carries it.
 */
export const GUARD_MESSAGE_SOURCE = "nullbanner-popup-guard";

/** Attribute on <html> used for the one-time nonce handoff. */
export const GUARD_NONCE_ATTR = "data-nullbanner-guard";

export interface GuardBridgeMessage {
  source: typeof GUARD_MESSAGE_SOURCE;
  nonce: string;
  /** true = block popups on this page; false = protection is off here. */
  armed: boolean;
}

export function isGuardBridgeMessage(data: unknown): data is GuardBridgeMessage {
  if (typeof data !== "object" || data === null) return false;
  const m = data as Partial<GuardBridgeMessage>;
  return (
    m.source === GUARD_MESSAGE_SOURCE && typeof m.nonce === "string" && typeof m.armed === "boolean"
  );
}
