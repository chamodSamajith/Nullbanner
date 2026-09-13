// SPDX-License-Identifier: GPL-3.0-only
interface HeaderProps {
  globalEnabled: boolean;
  onToggleGlobal: () => void;
}

export function Header({ globalEnabled, onToggleGlobal }: HeaderProps) {
  return (
    <header class="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
      <span class="font-semibold text-slate-900 dark:text-slate-100 tracking-tight">Nullbanner</span>
      <button
        type="button"
        role="switch"
        aria-checked={globalEnabled}
        aria-label="Global protection"
        onClick={onToggleGlobal}
        class={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 ${
          globalEnabled ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"
        }`}
      >
        <span
          class={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            globalEnabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </header>
  );
}
