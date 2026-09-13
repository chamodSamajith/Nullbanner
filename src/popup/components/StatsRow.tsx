// SPDX-License-Identifier: GPL-3.0-only

// Phase 1 does not report a numeric "blocked" count. Accurate counts need
// chrome.declarativeNetRequest.getMatchedRules, which is quota-limited
// (~20 calls / 10 min) and requires the declarativeNetRequestFeedback
// permission — deferred to a later phase. This row shows protection status
// instead of a count.
interface StatsRowProps {
  globalEnabled: boolean;
  siteDisabled: boolean;
}

export function StatsRow({ globalEnabled, siteDisabled }: StatsRowProps) {
  const active = globalEnabled && !siteDisabled;
  return (
    <section class="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
      <div class="rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm">
        <span class="text-slate-500 dark:text-slate-400">Network filtering</span>
        <p class={`font-semibold ${active ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}`}>
          {active ? "Active on this page" : "Not active on this page"}
        </p>
      </div>
    </section>
  );
}
