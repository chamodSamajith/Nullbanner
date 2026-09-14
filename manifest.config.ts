// SPDX-License-Identifier: GPL-3.0-only
import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

// Phase 1: no host_permissions and no "scripting" permission.
// declarativeNetRequest block/allow rules and activeTab (for reading the
// current tab's hostname in the popup) do not require broad host access.
//
// The popup/redirect guard below is the one exception: it needs a static
// content script on every page to override window.open before page scripts
// run. A *static* content_scripts entry (as opposed to the dynamic
// chrome.scripting.executeScript API) grants itself page access via its own
// "matches" field and does NOT require a separate host_permissions or
// "scripting" permission entry — so this still doesn't pull in the broader
// Phase 2 permissions, but Chrome's install-time permission prompt for this
// extension will now mention reading/changing data on all sites, which is
// inherent to any content script with <all_urls> matches.
interface GuardScript {
  matches: string[];
  js: string[];
  run_at: "document_start";
  all_frames: true;
  match_origin_as_fallback: true;
  world?: "MAIN" | "ISOLATED";
}

// Both guard scripts run on every page, in every frame, at document_start.
// `match_origin_as_fallback` also covers about:blank / srcdoc / data: frames
// (which inherit the parent's origin) — the classic popunder trick is to call
// open() from a throwaway about:blank iframe where content scripts don't run.
// crxjs's manifest typings predate that field, so the entries are built via
// a local interface (structural typing lets the extra field through, and it
// is emitted verbatim into dist/manifest.json). Chrome has supported it
// since 79.
function guardScript(js: string, extra: Pick<GuardScript, "world">): GuardScript {
  return {
    matches: ["<all_urls>"],
    js: [js],
    run_at: "document_start",
    all_frames: true,
    match_origin_as_fallback: true,
    ...extra
  };
}

export default defineManifest({
  manifest_version: 3,
  name: "Nullbanner",
  version: pkg.version,
  description: "Blocks ads and trackers. Open source, private, fast.",
  permissions: ["declarativeNetRequest", "storage", "activeTab"],
  background: {
    service_worker: "src/background/index.ts",
    type: "module"
  },
  action: {
    default_popup: "src/popup/index.html"
  },
  options_page: "src/options/index.html",
  content_scripts: [
    guardScript("src/content/guard-main.ts", { world: "MAIN" }),
    guardScript("src/content/guard-bridge.ts", {})
  ],
  declarative_net_request: {
    rule_resources: [
      {
        id: "test-ruleset",
        enabled: true,
        path: "rulesets/test-ruleset.json"
      },
      {
        id: "ad-networks",
        enabled: true,
        path: "rulesets/ad-networks.json"
      }
    ]
  },
  icons: {
    "16": "public/icons/16.png",
    "32": "public/icons/32.png",
    "48": "public/icons/48.png",
    "128": "public/icons/128.png"
  }
});
