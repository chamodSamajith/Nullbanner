// SPDX-License-Identifier: GPL-3.0-only
import { getStorage, initStorage, updateStorage } from "../shared/storage";
import { onMessage, type StatusResponse } from "../shared/messaging";
import { TEST_RULESET_ID } from "../shared/types";

// Dynamic rule IDs must be stable per-hostname integers so toggling a site
// off then on again reuses the same ID instead of leaking a fresh one each
// time (chrome.declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES
// is finite). We derive it with a small FNV-1a hash, folded into DNR's valid
// rule-id range (1 .. 2^31-1), with a linear probe on the rare collision.
function hashHostname(hostname: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < hostname.length; i++) {
    hash ^= hostname.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Force positive, keep well under the int32 rule-id ceiling.
  return (hash >>> 1) || 1;
}

async function ruleIdForHostname(hostname: string): Promise<number> {
  const base = hashHostname(hostname);
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = new Set(existing.map((r) => r.id));

  // If a rule with this exact ID already carries a different hostname's
  // condition, probe forward. This keeps IDs deterministic in the common
  // case (no collision) while staying safe in the rare case.
  let candidate = base;
  const owner = existing.find((r) => r.id === candidate);
  if (owner && owner.condition.requestDomains?.[0] !== hostname) {
    while (existingIds.has(candidate)) candidate++;
  }
  return candidate;
}

// Storage is the single source of truth for the allowlist — the popup, the
// dynamic DNR rule, and the content-script guard (guard-bridge.ts) all key
// off it, so they can never disagree with each other.
async function isSiteDisabled(hostname: string): Promise<boolean> {
  const { siteAllowlist } = await getStorage();
  return siteAllowlist.includes(hostname);
}

async function toggleSite(hostname: string): Promise<boolean> {
  const ruleId = await ruleIdForHostname(hostname);
  const disabled = await isSiteDisabled(hostname);

  if (disabled) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [ruleId] });
    await updateStorage((s) => ({
      ...s,
      siteAllowlist: s.siteAllowlist.filter((h) => h !== hostname)
    }));
    return false;
  }

  // allowAllRequests on a document request whitelists every sub-request
  // that document makes. The document is identified by requestDomains —
  // NOT initiatorDomains, which for a navigation is the *referring* page
  // (or nothing at all when the URL is typed into the address bar).
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [ruleId], // idempotent: replace if a stale copy exists
    addRules: [
      {
        id: ruleId,
        priority: 1,
        action: { type: chrome.declarativeNetRequest.RuleActionType.ALLOW_ALL_REQUESTS },
        condition: {
          requestDomains: [hostname],
          resourceTypes: [
            chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
            chrome.declarativeNetRequest.ResourceType.SUB_FRAME
          ]
        }
      }
    ]
  });
  await updateStorage((s) => ({
    ...s,
    siteAllowlist: s.siteAllowlist.includes(hostname) ? s.siteAllowlist : [...s.siteAllowlist, hostname]
  }));
  return true;
}

async function toggleGlobal(): Promise<boolean> {
  const storage = await getStorage();
  const nextEnabled = !storage.globalEnabled;

  if (nextEnabled) {
    await chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds: [TEST_RULESET_ID] });
  } else {
    await chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: [TEST_RULESET_ID] });
  }
  await updateStorage((s) => ({ ...s, globalEnabled: nextEnabled }));
  return nextEnabled;
}

async function updateBadge(): Promise<void> {
  const { globalEnabled } = await getStorage();
  await chrome.action.setBadgeText({ text: globalEnabled ? "" : "OFF" });
  await chrome.action.setBadgeBackgroundColor({ color: "#dc2626" });
}

chrome.runtime.onInstalled.addListener(() => {
  void (async () => {
    await initStorage();
    await updateBadge();
  })();
});

onMessage((message) => {
  switch (message.type) {
    case "GET_STATUS":
      return (async (): Promise<StatusResponse> => {
        const storage = await getStorage();
        const siteDisabled = await isSiteDisabled(message.hostname);
        return {
          globalEnabled: storage.globalEnabled,
          siteDisabled,
          version: chrome.runtime.getManifest().version
        };
      })();
    case "TOGGLE_SITE":
      return (async () => {
        await toggleSite(message.hostname);
        return { ok: true as const };
      })();
    case "TOGGLE_GLOBAL":
      return (async () => {
        await toggleGlobal();
        await updateBadge();
        return { ok: true as const };
      })();
    default:
      return undefined;
  }
});
