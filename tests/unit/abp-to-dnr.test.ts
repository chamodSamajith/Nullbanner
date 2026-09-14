// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from "vitest";
import { convertLine, convertList } from "../../src/compiler/abp-to-dnr";

function rule(line: string) {
  const r = convertLine(line);
  if ("skip" in r) throw new Error(`expected a rule for ${line}, got skip:${r.skip}`);
  return r.rule;
}
function skip(line: string) {
  const r = convertLine(line);
  if ("rule" in r) throw new Error(`expected a skip for ${line}, got a rule`);
  return r.skip;
}

describe("convertLine", () => {
  it("converts a plain domain block with ABP's default types (everything but the document)", () => {
    expect(rule("||ads.example.com^")).toEqual({
      priority: 1,
      action: { type: "block" },
      condition: { urlFilter: "||ads.example.com^", isUrlFilterCaseSensitive: false }
    });
  });

  it("maps type options, including aliases and negation", () => {
    expect(rule("||a.com^$script,image").condition.resourceTypes).toEqual(["script", "image"]);
    expect(rule("||a.com^$xhr,frame,beacon").condition.resourceTypes).toEqual([
      "xmlhttprequest",
      "sub_frame",
      "ping"
    ]);
    // negation-only keeps ABP's implicit main_frame exclusion
    expect(rule("||a.com^$~script").condition.excludedResourceTypes).toEqual(["script", "main_frame"]);
  });

  it("maps party and domain options", () => {
    expect(rule("/banner.$third-party").condition.domainType).toBe("thirdParty");
    expect(rule("/banner.$~third-party").condition.domainType).toBe("firstParty");
    const c = rule("||a.com^$domain=x.com|~y.x.com|Ünï.com").condition;
    expect(c.initiatorDomains).toEqual(["x.com", "xn--n-nga1b.com"]);
    expect(c.excludedInitiatorDomains).toEqual(["y.x.com"]);
  });

  it("turns document exceptions into allowAllRequests", () => {
    expect(rule("@@||good.com^$document")).toEqual({
      priority: 1,
      action: { type: "allowAllRequests" },
      condition: {
        urlFilter: "||good.com^",
        isUrlFilterCaseSensitive: false,
        resourceTypes: ["main_frame"]
      }
    });
    expect(rule("@@||good.com^$document,subdocument").condition.resourceTypes).toEqual([
      "main_frame",
      "sub_frame"
    ]);
  });

  it("assigns priorities so exceptions and $important resolve like ABP", () => {
    expect(rule("||a.com^").priority).toBe(1);
    expect(rule("@@||a.com^").priority).toBe(1); // allow wins a tie in DNR
    expect(rule("||a.com^$important").priority).toBe(2);
    expect(rule("@@||a.com^$important").priority).toBe(3);
  });

  it("honours match-case and a pattern-less scoped rule", () => {
    expect(rule("||a.com/Ad$match-case").condition.isUrlFilterCaseSensitive).toBe(true);
    expect(rule("$script,domain=x.com").condition).toEqual({
      isUrlFilterCaseSensitive: false,
      resourceTypes: ["script"],
      initiatorDomains: ["x.com"]
    });
  });

  it("skips what DNR cannot express, with a reason", () => {
    expect(skip("! a comment")).toBe("comment");
    expect(skip("[Adblock Plus 2.0]")).toBe("comment");
    expect(skip("example.com##.ad")).toBe("cosmetic");
    expect(skip("example.com#@#.ad")).toBe("cosmetic");
    expect(skip("/^https?:\\/\\/ads\\./")).toBe("regex");
    expect(skip("||a.com^$popup")).toBe("unsupported-option");
    expect(skip("||a.com^$csp=script-src 'none'")).toBe("unsupported-pattern"); // space in option -> pattern
    expect(skip("||a.com^$redirect=noopjs")).toBe("unsupported-option");
    expect(skip("@@||a.com^$generichide")).toBe("no-network-effect");
    expect(skip("||a.com^$domain=example.*")).toBe("wildcard-domain");
    expect(skip("||ünïcode.com^")).toBe("unsupported-pattern");
    expect(skip("*")).toBe("unsupported-pattern"); // would match the whole web
  });
});

describe("convertList", () => {
  it("numbers rules contiguously, dedupes, and reports stats", () => {
    const { rules, stats } = convertList(
      ["! header", "||a.com^", "||b.com^$script", "||a.com^", "example.com##.x", ""].join("\n"),
      10
    );
    expect(rules.map((r) => r.id)).toEqual([10, 11]);
    expect(stats.converted).toBe(2);
    expect(stats.skipped.duplicate).toBe(1);
    expect(stats.skipped.cosmetic).toBe(1);
    expect(stats.skipped.comment).toBe(2); // header + blank line
    expect(stats.sourceLines).toBe(6);
  });
});
