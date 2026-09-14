// SPDX-License-Identifier: GPL-3.0-only
import { getStorage, initStorage, updateStorage } from "../shared/storage";
import { onMessage, type StatusResponse } from "../shared/messaging";
import { BUILTIN_RULESET_IDS, LIST_RULESET_IDS } from "../shared/filter-lists";
import type { ListRulesetStatus } from "../shared/types";

// The per-site allowAllRequests rule must outrank every compiled filter rule,
// including $important blocks (priority 2) — see src/compiler/abp-to-dnr.ts.
const SITE_ALLOW_PRIORITY = 100;

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
        priority: SITE_ALLOW_PRIORITY,
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

/**
 * Enable the compiled filter lists (EasyList, EasyPrivacy, …) one at a time,
 * in the priority order of FILTER_LISTS. Together they exceed Chrome's
 * guaranteed 30,000 static rules; how many more fit depends on the global
 * pool shared with every other DNR extension the user has installed
 * (MAX_NUMBER_OF_STATIC_RULES). Chrome rejects an enable that would exceed
 * it, so each list is tried on its own and the outcome recorded for the
 * options page. Enabled rulesets persist, so this is cheap to re-run.
 */
async function enableListRulesets(): Promise<void> {
  const alreadyOn = new Set(await chrome.declarativeNetRequest.getEnabledRulesets());
  const status: Record<string, ListRulesetStatus> = {};
  for (const id of LIST_RULESET_IDS) {
    if (alreadyOn.has(id)) {
      status[id] = "enabled";
      continue;
    }
    try {
      await chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds: [id] });
      status[id] = "enabled";
    } catch (error) {
      status[id] = "over-budget";
      console.warn(`Nullbanner: could not enable ruleset "${id}":`, error);
    }
  }
  await updateStorage((s) => ({ ...s, listRulesets: status }));
}

async function applyGlobalState(enabled: boolean): Promise<void> {
  if (enabled) {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: BUILTIN_RULESET_IDS
    });
    await enableListRulesets();
  } else {
    const on = await chrome.declarativeNetRequest.getEnabledRulesets();
    if (on.length) {
      await chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: on });
    }
  }
}

async function toggleGlobal(): Promise<boolean> {
  const storage = await getStorage();
  const nextEnabled = !storage.globalEnabled;
  await applyGlobalState(nextEnabled);
  await updateStorage((s) => ({ ...s, globalEnabled: nextEnabled }));
  return nextEnabled;
}

async function updateBadge(): Promise<void> {
  const { globalEnabled } = await getStorage();
  await chrome.action.setBadgeText({ text: globalEnabled ? "" : "OFF" });
  await chrome.action.setBadgeBackgroundColor({ color: "#dc2626" });
}

async function syncRulesets(): Promise<void> {
  const { globalEnabled } = await getStorage();
  await applyGlobalState(globalEnabled);
}

chrome.runtime.onInstalled.addListener(() => {
  void (async () => {
    await initStorage();
    await syncRulesets();
    await updateBadge();
  })();
});

// Rule budgets can change between sessions (another DNR extension installed
// or removed), so re-check what could be enabled on every browser start.
chrome.runtime.onStartup.addListener(() => {
  void syncRulesets();
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
