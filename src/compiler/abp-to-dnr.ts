// SPDX-License-Identifier: GPL-3.0-only

/**
 * Converts Adblock-Plus-syntax filter lists (EasyList, EasyPrivacy, …) into
 * Chrome declarativeNetRequest rules.
 *
 * Only *network* filters are handled. Cosmetic filters (`##`, `#@#`, …) are
 * Phase 2's job and are skipped here, as is anything DNR has no equivalent
 * for (regex patterns, $csp, $redirect, $removeparam, $popup, …). Every
 * skipped line is counted by reason so the compile step can report what a
 * list lost in translation.
 *
 * This module runs both under Node (scripts/compile-lists.ts, via
 * --experimental-strip-types) and under Vitest, so it must not touch the
 * `chrome` namespace at runtime — DNR shapes are declared locally.
 */

export type ResourceType =
  | "main_frame"
  | "sub_frame"
  | "stylesheet"
  | "script"
  | "image"
  | "font"
  | "object"
  | "xmlhttprequest"
  | "ping"
  | "media"
  | "websocket"
  | "other";

export interface DnrRule {
  id: number;
  priority: number;
  action: { type: "block" | "allow" | "allowAllRequests" };
  condition: {
    urlFilter?: string;
    isUrlFilterCaseSensitive?: boolean;
    resourceTypes?: ResourceType[];
    excludedResourceTypes?: ResourceType[];
    domainType?: "firstParty" | "thirdParty";
    initiatorDomains?: string[];
    excludedInitiatorDomains?: string[];
  };
}

export type SkipReason =
  | "comment"
  | "cosmetic"
  | "regex"
  | "unsupported-option"
  | "unsupported-pattern"
  | "no-network-effect"
  | "wildcard-domain"
  | "invalid-domain"
  | "duplicate";

export interface ConvertStats {
  sourceLines: number;
  converted: number;
  skipped: Record<SkipReason, number>;
}

export interface ConvertResult {
  rules: DnrRule[];
  stats: ConvertStats;
}

// ABP $option name -> DNR resource type. Aliases included.
const TYPE_OPTIONS: Record<string, ResourceType> = {
  script: "script",
  image: "image",
  stylesheet: "stylesheet",
  object: "object",
  xmlhttprequest: "xmlhttprequest",
  xhr: "xmlhttprequest",
  subdocument: "sub_frame",
  frame: "sub_frame",
  document: "main_frame",
  doc: "main_frame",
  websocket: "websocket",
  font: "font",
  media: "media",
  ping: "ping",
  beacon: "ping",
  other: "other"
};

const ALL_TYPES: ResourceType[] = [
  "main_frame",
  "sub_frame",
  "stylesheet",
  "script",
  "image",
  "font",
  "object",
  "xmlhttprequest",
  "ping",
  "media",
  "websocket",
  "other"
];

// Options that only affect cosmetic filtering or have no DNR meaning on
// their own. A rule consisting solely of these is dropped as
// "no-network-effect"; combined with real options they are ignored.
const IGNORED_OPTIONS = new Set(["generichide", "genericblock", "elemhide", "specifichide"]);

// Options DNR cannot express; any rule carrying one is dropped.
const UNSUPPORTED_OPTIONS = new Set([
  "popup",
  "csp",
  "redirect",
  "redirect-rule",
  "removeparam",
  "rewrite",
  "header",
  "denyallow",
  "empty",
  "mp4",
  "webrtc",
  "object-subrequest",
  "replace",
  "cookie",
  "app",
  "network",
  "method",
  "to",
  "from",
  "strict1p",
  "strict3p",
  "badfilter",
  "inline-script",
  "inline-font",
  "removeheader",
  "jsinject",
  "urlblock",
  "content",
  "extension",
  "stealth",
  "permissions",
  "hls",
  "jsonprune",
  "xmlprune",
  "referrerpolicy",
  "ipaddress"
]);

const COSMETIC_MARKER = /#[@?$%]?#/;
// Option lists never contain whitespace or quotes; $csp values do, which is
// how those lines end up treated as (unsupported) patterns instead.
const OPTIONS_TEXT = /^[^\s"]*$/;

function isAscii(s: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7f]*$/.test(s);
}

function parseDomainList(value: string): { include: string[]; exclude: string[] } | SkipReason {
  const include: string[] = [];
  const exclude: string[] = [];
  for (const raw of value.split("|")) {
    if (!raw) continue;
    const negated = raw.startsWith("~");
    const name = (negated ? raw.slice(1) : raw).toLowerCase();
    if (name.includes("*")) return "wildcard-domain";
    let host: string;
    try {
      host = new URL(`http://${name}`).hostname; // normalises + punycodes
    } catch {
      return "invalid-domain";
    }
    if (!host || !/^[a-z0-9.-]+$/.test(host)) return "invalid-domain";
    (negated ? exclude : include).push(host);
  }
  return { include, exclude };
}

export type LineResult = { rule: Omit<DnrRule, "id"> } | { skip: SkipReason };

/** Convert a single filter line. Rule IDs are assigned by convertList(). */
export function convertLine(rawLine: string): LineResult {
  const line = rawLine.trim();
  if (!line || line.startsWith("!") || line.startsWith("[")) return { skip: "comment" };
  if (COSMETIC_MARKER.test(line)) return { skip: "cosmetic" };

  let text = line;
  let isException = false;
  if (text.startsWith("@@")) {
    isException = true;
    text = text.slice(2);
  }

  // Split off $options — the last '$' whose tail looks like an option list.
  let pattern = text;
  let optionsText = "";
  const dollar = text.lastIndexOf("$");
  if (dollar >= 0 && OPTIONS_TEXT.test(text.slice(dollar + 1))) {
    pattern = text.slice(0, dollar);
    optionsText = text.slice(dollar + 1);
  }

  if (pattern.length > 1 && pattern.startsWith("/") && pattern.endsWith("/")) return { skip: "regex" };
  if (!isAscii(pattern)) return { skip: "unsupported-pattern" };

  const include = new Set<ResourceType>();
  const exclude = new Set<ResourceType>();
  let domainType: DnrRule["condition"]["domainType"];
  let domains: { include: string[]; exclude: string[] } | undefined;
  let important = false;
  let matchCase = false;
  let sawRealOption = false;
  let sawIgnoredOption = false;

  for (const rawOpt of optionsText ? optionsText.split(",") : []) {
    if (!rawOpt) continue;
    const eq = rawOpt.indexOf("=");
    const name = (eq === -1 ? rawOpt : rawOpt.slice(0, eq)).toLowerCase();
    const value = eq === -1 ? "" : rawOpt.slice(eq + 1);
    const negated = name.startsWith("~");
    const bare = negated ? name.slice(1) : name;

    if (UNSUPPORTED_OPTIONS.has(bare)) return { skip: "unsupported-option" };
    if (IGNORED_OPTIONS.has(bare)) {
      sawIgnoredOption = true;
      continue;
    }
    sawRealOption = true;

    if (bare in TYPE_OPTIONS) {
      (negated ? exclude : include).add(TYPE_OPTIONS[bare]!);
    } else if (bare === "all") {
      for (const t of ALL_TYPES) include.add(t);
    } else if (bare === "third-party" || bare === "3p") {
      domainType = negated ? "firstParty" : "thirdParty";
    } else if (bare === "first-party" || bare === "1p") {
      domainType = negated ? "thirdParty" : "firstParty";
    } else if (bare === "domain") {
      const parsed = parseDomainList(value);
      if (typeof parsed === "string") return { skip: parsed };
      domains = parsed;
    } else if (bare === "important") {
      important = true;
    } else if (bare === "match-case") {
      matchCase = true;
    } else {
      return { skip: "unsupported-option" };
    }
  }

  if (sawIgnoredOption && !sawRealOption) return { skip: "no-network-effect" };

  // --- pattern -> urlFilter --------------------------------------------------
  let urlFilter: string | undefined = pattern;
  if (urlFilter === "" || urlFilter === "*" || urlFilter === "|" || urlFilter === "||") {
    urlFilter = undefined; // match everything; scoping comes from options
  }
  if (urlFilter !== undefined && (urlFilter.length > 2000 || /[\s"]/.test(urlFilter))) {
    return { skip: "unsupported-pattern" };
  }
  // A rule with no pattern and no scoping would match the whole web.
  if (urlFilter === undefined && !domains && !domainType && include.size === 0 && exclude.size === 0) {
    return { skip: "unsupported-pattern" };
  }

  // --- resource types ---------------------------------------------------
  const condition: DnrRule["condition"] = {};
  if (urlFilter !== undefined) condition.urlFilter = urlFilter;
  // Chrome 118 flipped the default to case-insensitive; be explicit so the
  // output means the same thing on every Chrome version.
  condition.isUrlFilterCaseSensitive = matchCase;

  let action: DnrRule["action"]["type"] = isException ? "allow" : "block";

  if (isException && include.has("main_frame")) {
    // `@@||site^$document` in ABP means "turn blocking off on this site";
    // allowAllRequests on the document request is DNR's equivalent.
    action = "allowAllRequests";
    const frames: ResourceType[] = ["main_frame"];
    if (include.has("sub_frame")) frames.push("sub_frame");
    condition.resourceTypes = frames;
  } else if (include.size > 0) {
    const types = [...include].filter((t) => !exclude.has(t));
    if (types.length === 0) return { skip: "unsupported-option" };
    condition.resourceTypes = types;
  } else if (exclude.size > 0) {
    // ABP's implicit default excludes the document itself; so does DNR when
    // resourceTypes is omitted, but NOT when only excludedResourceTypes is
    // set — so add main_frame explicitly.
    condition.excludedResourceTypes = [...new Set([...exclude, "main_frame" as ResourceType])];
  }
  // (no types at all) -> DNR default: every type except main_frame, which
  // matches ABP's default exactly.

  if (domainType) condition.domainType = domainType;
  if (domains) {
    if (domains.include.length) condition.initiatorDomains = domains.include;
    if (domains.exclude.length) condition.excludedInitiatorDomains = domains.exclude;
  }

  // Priority: exceptions beat blocks at equal priority in DNR (allow wins
  // ties), $important blocks beat ordinary exceptions, and an $important
  // exception beats everything. Keep these below SITE_ALLOW_PRIORITY.
  let priority = 1;
  if (important) priority = isException ? 3 : 2;

  return { rule: { priority, action: { type: action }, condition } };
}

/** Convert a whole list. IDs are 1-based and contiguous. */
export function convertList(text: string, startId = 1): ConvertResult {
  const rules: DnrRule[] = [];
  const seen = new Set<string>();
  const stats: ConvertStats = {
    sourceLines: 0,
    converted: 0,
    skipped: {
      comment: 0,
      cosmetic: 0,
      regex: 0,
      "unsupported-option": 0,
      "unsupported-pattern": 0,
      "no-network-effect": 0,
      "wildcard-domain": 0,
      "invalid-domain": 0,
      duplicate: 0
    }
  };

  let id = startId;
  for (const line of text.split(/\r?\n/)) {
    stats.sourceLines++;
    const result = convertLine(line);
    if ("skip" in result) {
      stats.skipped[result.skip]++;
      continue;
    }
    const key = JSON.stringify(result.rule);
    if (seen.has(key)) {
      stats.skipped.duplicate++;
      continue;
    }
    seen.add(key);
    rules.push({ id: id++, ...result.rule });
    stats.converted++;
  }
  return { rules, stats };
}
