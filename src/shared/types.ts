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
  /**
   * Outcome of enabling each compiled filter list (see filter-lists.ts):
   * "enabled", or "over-budget" if Chrome's static-rule budget was exhausted
   * before this list. Shown on the options page.
   */
  listRulesets: Record<string, ListRulesetStatus>;
}

export type ListRulesetStatus = "enabled" | "over-budget";

export const DEFAULT_STORAGE: StorageSchema = {
  schemaVersion: 1,
  globalEnabled: true,
  siteAllowlist: [],
  listRulesets: {}
};

export const TEST_RULESET_ID = "test-ruleset";
