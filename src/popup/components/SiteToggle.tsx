// SPDX-License-Identifier: GPL-3.0-only
interface SiteToggleProps {
  hostname: string;
  siteDisabled: boolean;
  showReloadHint: boolean;
  onToggleSite: () => void;
  onReload: () => void;
  disabled?: boolean;
}

export function SiteToggle({
  hostname,
  siteDisabled,
  showReloadHint,
  onToggleSite,
  onReload,
  disabled
}: SiteToggleProps) {
  const enabled = !siteDisabled;
  return (
    <section class="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
      <p class="text-xs text-slate-500 dark:text-slate-400 truncate" title={hostname}>
        {hostname}
      </p>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={disabled}
        onClick={onToggleSite}
        class={`mt-1 w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
          enabled
            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
            : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
        }`}
      >
        <span>{enabled ? "Enabled on this site" : "Disabled on this site"}</span>
        <span
          aria-hidden="true"
          class={`h-2.5 w-2.5 rounded-full ${enabled ? "bg-emerald-500" : "bg-slate-400"}`}
        />
      </button>
      {showReloadHint && (
        <div class="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Reload the page to apply</span>
          <button
            type="button"
            onClick={onReload}
            class="rounded px-2 py-1 font-medium text-blue-600 dark:text-blue-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Reload
          </button>
        </div>
      )}
    </section>
  );
}
