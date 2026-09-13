// SPDX-License-Identifier: GPL-3.0-only
import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

// Phase 1: no host_permissions. declarativeNetRequest block/allow rules and
// activeTab (for reading the current tab's hostname in the popup) do not
// require broad host access. <all_urls> / "scripting" will be added in
// Phase 2 once cosmetic (content-script) filtering needs page access.
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
  declarative_net_request: {
    rule_resources: [
      {
        id: "test-ruleset",
        enabled: true,
        path: "rulesets/test-ruleset.json"
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
