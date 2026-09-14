// SPDX-License-Identifier: GPL-3.0-only
import { vi } from "vitest";

// sinon-chrome (named in the original brief) predates Manifest V3's
// declarativeNetRequest API entirely and does not mock it, so it can't
// exercise the code under test here. This is a small hand-rolled mock
// scoped to exactly the chrome.* surface Nullbanner's background worker
// uses, backed by an in-memory store so assertions can inspect state
// directly instead of spying on call args.

export function installChromeMock() {
  const storageData: Record<string, unknown> = {};
  let dynamicRules: chrome.declarativeNetRequest.Rule[] = [];
  const enabledRulesets = new Set<string>(["test-ruleset", "ad-networks"]);
  const messageListeners: Array<
    (message: unknown, sender: unknown, sendResponse: (r: unknown) => void) => boolean | void
  > = [];

  const chromeMock = {
    runtime: {
      onInstalled: { addListener: vi.fn() },
      onStartup: { addListener: vi.fn() },
      onMessage: {
        addListener: vi.fn((fn: (typeof messageListeners)[number]) => {
          messageListeners.push(fn);
        })
      },
      getManifest: vi.fn(() => ({ version: "0.1.0" })),
      openOptionsPage: vi.fn(),
      sendMessage: vi.fn(
        (message: unknown) =>
          new Promise((resolve) => {
            for (const listener of messageListeners) {
              const handled = listener(message, {}, resolve);
              if (handled) return;
            }
            resolve(undefined);
          })
      )
    },
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: storageData[key] })),
        set: vi.fn(async (items: Record<string, unknown>) => {
          Object.assign(storageData, items);
        })
      }
    },
    declarativeNetRequest: {
      RuleActionType: { ALLOW_ALL_REQUESTS: "allowAllRequests", BLOCK: "block", ALLOW: "allow" },
      ResourceType: { MAIN_FRAME: "main_frame", SUB_FRAME: "sub_frame" },
      getDynamicRules: vi.fn(async () => dynamicRules),
      getEnabledRulesets: vi.fn(async () => [...enabledRulesets]),
      updateDynamicRules: vi.fn(
        async (opts: { addRules?: chrome.declarativeNetRequest.Rule[]; removeRuleIds?: number[] }) => {
          if (opts.removeRuleIds) {
            dynamicRules = dynamicRules.filter((r) => !opts.removeRuleIds!.includes(r.id));
          }
          if (opts.addRules) {
            dynamicRules = [...dynamicRules, ...opts.addRules];
          }
        }
      ),
      updateEnabledRulesets: vi.fn(
        async (opts: { enableRulesetIds?: string[]; disableRulesetIds?: string[] }) => {
          for (const id of opts.enableRulesetIds ?? []) {
            if (id === "__over-budget__") throw new Error("Rule count exceeds available static rule count");
            enabledRulesets.add(id);
          }
          opts.disableRulesetIds?.forEach((id) => enabledRulesets.delete(id));
        }
      )
    },
    action: {
      setBadgeText: vi.fn(async () => {}),
      setBadgeBackgroundColor: vi.fn(async () => {})
    },
    tabs: {
      query: vi.fn(),
      reload: vi.fn()
    }
  };

  vi.stubGlobal("chrome", chromeMock);

  return { chromeMock, storageData, getDynamicRules: () => dynamicRules, enabledRulesets };
}
