# Third-party filter lists

`pnpm build` downloads and compiles the following lists into DNR rulesets
(`rulesets/<id>.json`, git-ignored). They are not Nullbanner's work; each is
redistributed under its own licence, which is compatible with this project's
GPLv3 and must be preserved in any distribution, including the Chrome Web
Store listing.

| List | Source | Licence |
|------|--------|---------|
| EasyList | https://easylist.to/easylist/easylist.txt | GPL-3.0 / CC BY-SA 3.0 (dual) — https://easylist.to/pages/licence.html |
| EasyPrivacy | https://easylist.to/easylist/easyprivacy.txt | GPL-3.0 / CC BY-SA 3.0 (dual) — https://easylist.to/pages/licence.html |

The compiler keeps only network filters DNR can express and drops the rest
(cosmetic rules, regex patterns, `$csp`, `$redirect`, `$popup`, …); the
per-list skip counts are printed at build time and written to
`public/lists.json`.
