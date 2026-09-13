// SPDX-License-Identifier: GPL-3.0-only

/**
 * Shared message shape for isolated-world -> MAIN-world communication
 * between guard-bridge.ts and guard-main.ts. Kept as plain data (no
 * functions/class instances) since it crosses a postMessage boundary.
 */
export const GUARD_MESSAGE_SOURCE = "nullbanner-popup-guard";

export interface GuardBridgeMessage {
  source: typeof GUARD_MESSAGE_SOURCE;
  /** true = block window.open() on this page; false = protection is off here. */
  armed: boolean;
}

export function isGuardBridgeMessage(data: unknown): data is GuardBridgeMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { source?: unknown }).source === GUARD_MESSAGE_SOURCE &&
    typeof (data as { armed?: unknown }).armed === "boolean"
  );
}
