# Test ruleset — what each rule does

JSON has no comments, so this file documents `test-ruleset.json` rule-by-rule.
This is a hand-written set of ~10 rules for validating the DNR pipeline
end-to-end during development. **It is not a real ad/tracker filter list** —
that's a later phase (real EasyList/EasyPrivacy compilation).

| id | Shape | Targets | Why it's here |
|----|-------|---------|---------------|
| 1  | Basic domain block, multiple resource types | `nullbanner-test-ads.example` | Canonical "block this ad domain everywhere" rule. |
| 2  | Domain block scoped by `resourceTypes: ["script"]` | `nullbanner-test-tracker.example` | Verifies resource-type scoping (allows non-script requests to the same host through). |
| 3  | Path-fragment block | any host, path containing `/ads/` | Common EasyList-style path pattern, no anchoring. |
| 4  | Block scoped by `initiatorDomains` | `nullbanner-scoped-tracker.example`, only when loaded from `nullbanner-publisher.example` | Verifies first-party-page scoping of a third-party block. |
| 5  | `allow` rule with higher `priority` | Same target as #4, but from `nullbanner-partner-allowed.example` | Verifies exception/allow rules correctly override a lower-priority block for a specific initiator. |
| 6  | Block via `requestDomains` (as opposed to `urlFilter`) | `nullbanner-test-cdn.example` | Confirms the newer `requestDomains` condition field works alongside `urlFilter`-based rules. |
| 7  | Block with `excludedResourceTypes` | `nullbanner-test-pixel.example/pixel.gif`, excluding `main_frame` | Verifies negative resource-type scoping (never blocks the pixel host if directly navigated to, only as a sub-resource). |
| 8  | Block scoped by `domainType: "thirdParty"` | `nullbanner-test-thirdparty.example` | Verifies third-party-only blocking (first-party requests to the same host are unaffected). |
| 9  | `regexFilter` block | Paths matching `^https?://nullbanner-test-regex\.example/track/[a-z0-9]+$` | Verifies regex-based conditions compile and match, distinct from `urlFilter` glob syntax. |
| 10 | Block with `excludedInitiatorDomains` | `nullbanner-test-ads.example`, `ping`/`csp_report` types, excluding the publisher's own domain | Verifies negative initiator scoping — the publisher's own beacons aren't blocked, third parties embedding the same tracker are. |

## Notes
- Rule IDs are static integers 1–10, reserved for this bundled ruleset only.
  Dynamic (per-site allowlist) rules generated at runtime use much larger,
  hostname-derived IDs (see `src/background/index.ts`) so the two ID spaces
  never collide.
- All domains referenced (`nullbanner-test-*.example`) are fictitious,
  reserved-TLD (`.example`, RFC 2606) hosts used only by
  `tests/e2e/fixtures/blocked-request.html` — they resolve to nothing on the
  real internet, so these rules have zero effect on real browsing during
  development.
