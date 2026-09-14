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

  it("global toggle enables/disables the test ruleset and updates storage", async () => {
    const { chromeMock, storageData } = installChromeMock();
    storageData.nullbanner = { ...DEFAULT_STORAGE };
    await import("../../src/background/index");
    const send = (msg: unknown) => chrome.runtime.sendMessage(msg);

    await send({ type: "TOGGLE_GLOBAL" });
    expect(chromeMock.declarativeNetRequest.updateEnabledRulesets).toHaveBeenCalledWith({
      disableRulesetIds: ["test-ruleset", "ad-networks"]
    });
    expect((storageData.nullbanner as { globalEnabled: boolean }).globalEnabled).toBe(false);

    await send({ type: "TOGGLE_GLOBAL" });
    expect(chromeMock.declarativeNetRequest.updateEnabledRulesets).toHaveBeenCalledWith({
      enableRulesetIds: ["test-ruleset", "ad-networks"]
    });
    expect((storageData.nullbanner as { globalEnabled: boolean }).globalEnabled).toBe(true);
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
