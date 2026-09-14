// SPDX-License-Identifier: GPL-3.0-only

/**
 * Persistent extension state, versioned so future migrations have a schema
 * to key off. Bump `schemaVersion` and add a migration in storage.ts if the
 * shape ever changes.
 *
 * Phase 1 note: we deliberately do NOT track a per-request "blocked" counter
 * here. Accurate counts require chrome.declarativeNetRequest.getMatchedRules,
 * which is quota-limited (~20 calls / 10 min) and needs the
 * declarativeNetRequestFeedback permission — both are deferred to a later
 * phase. For now the badge/popup only reflect on/off state.
 */
export interface StorageSchema {
  schemaVersion: 1;
  globalEnabled: boolean;
  /** Hostnames where blocking is turned off (dynamic allow rule active). */
  siteAllowlist: string[];
}

export const DEFAULT_STORAGE: StorageSchema = {
  schemaVersion: 1,
  globalEnabled: true,
  siteAllowlist: []
};

export const TEST_RULESET_ID = "test-ruleset";
export const AD_NETWORKS_RULESET_ID = "ad-networks";

/** Every static ruleset; the global switch enables/disables them together. */
export const RULESET_IDS: string[] = [TEST_RULESET_ID, AD_NETWORKS_RULESET_ID];
