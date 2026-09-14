# ad-networks ruleset — what each rule does

`ad-networks.json` is Nullbanner's first **real** blocking ruleset (unlike
`test-ruleset.json`, which only targets fictitious `.example` hosts). It is a
small, hand-curated seed aimed at one concrete problem: popunder / redirect
ad networks whose loader script hijacks the tab — e.g. lookmovie.date
loading `https://focusameneducation.com/<32-hex>/invoke.js` and then
navigating the tab to a fake "Ad Blocker Pro" install page.

It is a stopgap until Phase 4 compiles EasyList/EasyPrivacy, which cover
thousands of such hosts and are updated continuously.

| id | Shape | Targets | Why |
|----|-------|---------|-----|
| 1  | `regexFilter`, third-party `script` | Any `https://<host>/<32 hex chars>/invoke.js` | The loader URL signature used by an Adsterra-style popunder network. Matching the *shape* rather than the host means it still works when the network rotates to a new throwaway domain. |
| 2  | `requestDomains`, all sub-resource types | `focusameneducation.com`, `kettledroopingcontinuation.com`, `protrafficinspector.com`, `spendsdetachment.com` | The loader host observed on lookmovie.date plus the three hosts its obfuscated code calls out to. Blocked entirely as sub-resources. |
| 3  | `urlFilter`, incl. `main_frame` | `proadblocker.net` | The scam landing page the hijack sends users to. Blocking `main_frame` means even if a redirect slips through, the tab lands on Chrome's blocked-by-extension page instead of the scam. |

## Notes
- Rule IDs are local to this ruleset; they don't collide with
  `test-ruleset.json` (each static ruleset has its own ID space).
- Rule 1 counts against Chrome's per-extension regex-rule budget
  (`MAX_NUMBER_OF_REGEX_RULES`, 1000) — fine at this scale, worth remembering
  when Phase 4 generates rules in bulk.
- Rule 1 is deliberately *unanchored*. The anchored form
  `^https?://[^/]+/[a-f0-9]{32}/invoke\.js` is rejected by Chrome with
  `memoryLimitExceeded` (RE2's per-rule budget); verify any new regex with
  `chrome.declarativeNetRequest.isRegexSupported()` before shipping it.
- Both static rulesets are enabled/disabled together by the global switch
  (`RULESET_IDS` in `src/shared/types.ts`).
