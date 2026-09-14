// SPDX-License-Identifier: GPL-3.0-only

/**
 * The upstream filter lists Nullbanner compiles into static DNR rulesets.
 * Shared by the compile script (which downloads them), the background
 * worker (which enables them within Chrome's rule budget) and the options
 * page (which displays them).
 *
 * `id` doubles as the ruleset id in manifest.config.ts and the output file
 * name rulesets/<id>.json. Order matters: when Chrome's static-rule budget
 * can't fit every list, earlier lists win.
 */
export interface FilterList {
  id: string;
  name: string;
  url: string;
  license: string;
  homepage: string;
}

export const FILTER_LISTS: FilterList[] = [
  {
    id: "easylist",
    name: "EasyList",
    url: "https://easylist.to/easylist/easylist.txt",
    license: "GPL-3.0 / CC BY-SA 3.0",
    homepage: "https://easylist.to/"
  },
  {
    id: "easyprivacy",
    name: "EasyPrivacy",
    url: "https://easylist.to/easylist/easyprivacy.txt",
    license: "GPL-3.0 / CC BY-SA 3.0",
    homepage: "https://easylist.to/"
  }
];

/** Static rulesets that are always on (small, hand-written). */
export const BUILTIN_RULESET_IDS = ["test-ruleset", "ad-networks"];

/** Compiled upstream lists, enabled at install as the rule budget allows. */
export const LIST_RULESET_IDS = FILTER_LISTS.map((l) => l.id);
