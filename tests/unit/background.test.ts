// SPDX-License-Identifier: GPL-3.0-only
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installChromeMock } from "./chrome-mock";
import { DEFAULT_STORAGE } from "../../src/shared/types";

describe("background service worker", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("toggling a site adds exactly one dynamic rule, and toggling again removes it", async () => {
    const { getDynamicRules } = installChromeMock();
    await import("../../src/background/index");
    const { onMessage } = await import("../../src/shared/messaging");
    void onMessage;

    const send = (msg: unknown) => chrome.runtime.sendMessage(msg);

    await send({ type: "TOGGLE_SITE", hostname: "example.com" });
    expect(getDynamicRules()).toHaveLength(1);
    expect(getDynamicRules()[0]?.condition.requestDomains).toEqual(["example.com"]);
    // allowAllRequests must target the document itself (requestDomains), and
    // both frame types, or it silently does nothing for direct navigations.
    expect(getDynamicRules()[0]?.condition.initiatorDomains).toBeUndefined();
    expect(getDynamicRules()[0]?.condition.resourceTypes).toEqual(["main_frame", "sub_frame"]);
    expect(getDynamicRules()[0]?.action.type).toBe("allowAllRequests");

    await send({ type: "TOGGLE_SITE", hostname: "other.com" });
    expect(getDynamicRules()).toHaveLength(2);

    await send({ type: "TOGGLE_SITE", hostname: "example.com" });
    expect(getDynamicRules()).toHaveLength(1);
    expect(getDynamicRules()[0]?.condition.requestDomains).toEqual(["other.com"]);
  });

  it("reuses the same dynamic rule id for the same hostname across toggles", async () => {
    const { getDynamicRules } = installChromeMock();
    await import("../../src/background/index");
    const send = (msg: unknown) => chrome.runtime.sendMessage(msg);

    await send({ type: "TOGGLE_SITE", hostname: "example.com" });
    const firstId = getDynamicRules()[0]?.id;
    await send({ type: "TOGGLE_SITE", hostname: "example.com" }); // off
    await send({ type: "TOGGLE_SITE", hostname: "example.com" }); // on again
    const secondId = getDynamicRules()[0]?.id;

    expect(secondId).toBe(firstId);
  });

  it("global toggle disables every enabled ruleset, then re-enables builtins and lists", async () => {
    const { enabledRulesets, storageData } = installChromeMock();
    storageData.nullbanner = { ...DEFAULT_STORAGE };
    await import("../../src/background/index");
    const send = (msg: unknown) => chrome.runtime.sendMessage(msg);

    await send({ type: "TOGGLE_GLOBAL" });
    expect([...enabledRulesets]).toEqual([]);
    expect((storageData.nullbanner as { globalEnabled: boolean }).globalEnabled).toBe(false);

    await send({ type: "TOGGLE_GLOBAL" });
    expect([...enabledRulesets].sort()).toEqual(["ad-networks", "easylist", "easyprivacy", "test-ruleset"]);
    expect((storageData.nullbanner as { globalEnabled: boolean }).globalEnabled).toBe(true);
  });

  it("on install, enables compiled lists one by one and records an over-budget list", async () => {
    const { chromeMock, enabledRulesets, storageData } = installChromeMock();
    enabledRulesets.clear();
    const { LIST_RULESET_IDS } = await import("../../src/shared/filter-lists");
    // Make the second list "not fit" — the mock throws for this sentinel id.
    const original = [...LIST_RULESET_IDS];
    LIST_RULESET_IDS.splice(1, 1, "__over-budget__");
    try {
      await import("../../src/background/index");
      const onInstalled = chromeMock.runtime.onInstalled.addListener.mock.calls[0]?.[0] as () => void;
      onInstalled();
      await new Promise((r) => setTimeout(r, 0));

      expect(enabledRulesets.has("easylist")).toBe(true);
      expect(enabledRulesets.has("__over-budget__")).toBe(false);
      const stored = storageData.nullbanner as { listRulesets: Record<string, string> };
      expect(stored.listRulesets).toEqual({ easylist: "enabled", "__over-budget__": "over-budget" });
    } finally {
      LIST_RULESET_IDS.splice(0, LIST_RULESET_IDS.length, ...original);
    }
  });

  it("GET_STATUS reports siteDisabled correctly", async () => {
    installChromeMock();
    await import("../../src/background/index");
    const send = (msg: unknown) => chrome.runtime.sendMessage(msg);

    const before = await send({ type: "GET_STATUS", hostname: "example.com" });
    expect((before as { siteDisabled: boolean }).siteDisabled).toBe(false);

    await send({ type: "TOGGLE_SITE", hostname: "example.com" });
    const after = await send({ type: "GET_STATUS", hostname: "example.com" });
    expect((after as { siteDisabled: boolean }).siteDisabled).toBe(true);
  });
});
