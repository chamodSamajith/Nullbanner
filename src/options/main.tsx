// SPDX-License-Identifier: GPL-3.0-only
import { render } from "preact";
import "../popup/styles.css";
import { GITHUB_REPO_URL } from "../popup/components/Footer";

function OptionsPage() {
  const version = chrome.runtime.getManifest().version;
  return (
    <main class="min-h-screen bg-white dark:bg-slate-900 flex items-center justify-center p-8">
      <div class="max-w-md w-full space-y-4">
        <h1 class="text-xl font-semibold text-slate-900 dark:text-slate-100">Nullbanner</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">Version {version}</p>
        <div class="rounded-lg border border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-600 dark:text-slate-300">
          Filter list management, allowlist editing, and custom rules are coming in Phase 2.
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
