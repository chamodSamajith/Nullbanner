// SPDX-License-Identifier: GPL-3.0-only
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import "../popup/styles.css";
import { GITHUB_REPO_URL } from "../popup/components/Footer";
import { getStorage } from "../shared/storage";
import type { FilterList } from "../shared/filter-lists";
import type { ListRulesetStatus } from "../shared/types";

// Written by scripts/compile-lists.ts at build time (public/lists.json).
interface ListsMeta {
  generatedAt: string;
  lists: (FilterList & { ruleCount: number; sourceLines: number })[];
}

function statusLabel(status: ListRulesetStatus | undefined, globalEnabled: boolean): string {
  if (!globalEnabled) return "Off (global switch)";
  if (status === "enabled") return "Active";
  if (status === "over-budget") return "Not loaded — Chrome's rule limit is used up";
  return "Pending";
}

function OptionsPage() {
  const version = chrome.runtime.getManifest().version;
  const [meta, setMeta] = useState<ListsMeta | null>(null);
  const [status, setStatus] = useState<Record<string, ListRulesetStatus>>({});
  const [globalEnabled, setGlobalEnabled] = useState(true);

  useEffect(() => {
    void fetch(chrome.runtime.getURL("lists.json"))
      .then((r) => r.json() as Promise<ListsMeta>)
      .then(setMeta);
    void getStorage().then((s) => {
      setStatus(s.listRulesets);
      setGlobalEnabled(s.globalEnabled);
    });
  }, []);

  return (
    <main class="min-h-screen bg-white dark:bg-slate-900 flex justify-center p-8">
      <div class="max-w-xl w-full space-y-6">
        <div>
          <h1 class="text-xl font-semibold text-slate-900 dark:text-slate-100">Nullbanner</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400">Version {version}</p>
        </div>

        <section>
          <h2 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Filter lists</h2>
          <table class="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <tbody>
              {meta?.lists.map((list) => (
                <tr key={list.id} class="border-t border-slate-200 dark:border-slate-700 first:border-t-0">
                  <td class="px-3 py-2 align-top">
                    <a
                      href={list.homepage}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="font-medium text-slate-900 dark:text-slate-100 hover:underline"
                    >
                      {list.name}
                    </a>
                    <div class="text-xs text-slate-500 dark:text-slate-400">
                      {list.ruleCount.toLocaleString()} rules · {list.license}
                    </div>
                  </td>
                  <td class="px-3 py-2 text-right align-top text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {statusLabel(status[list.id], globalEnabled)}
                  </td>
                </tr>
              )) ?? (
                <tr>
                  <td class="px-3 py-2 text-slate-500">Loading…</td>
                </tr>
              )}
            </tbody>
          </table>
          {meta && (
            <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Lists compiled {new Date(meta.generatedAt).toLocaleDateString()} — refreshed with each
              Nullbanner update.
            </p>
          )}
        </section>

        <div class="rounded-lg border border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-600 dark:text-slate-300">
          Allowlist editing and custom rules are coming in a later phase.
        </div>
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          View on GitHub
        </a>
      </div>
    </main>
  );
}

const root = document.getElementById("app");
if (root) render(<OptionsPage />, root);
