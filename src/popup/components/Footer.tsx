// SPDX-License-Identifier: GPL-3.0-only

// Placeholder — fill in with the real repo before store submission.
export const GITHUB_REPO_URL = "https://github.com/REPLACE_ME/nullbanner";

interface FooterProps {
  hostname: string;
  version: string;
}

export function Footer({ hostname, version }: FooterProps) {
  const issueUrl = `${GITHUB_REPO_URL}/issues/new?${new URLSearchParams({
    title: `Issue on ${hostname}`,
    body: `Hostname: ${hostname}\nExtension version: ${version}`
  }).toString()}`;

  return (
    <footer class="flex items-center justify-between px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
      <button
        type="button"
        onClick={() => chrome.runtime.openOptionsPage()}
        class="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
      >
        Options
      </button>
      <a
        href={issueUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
      >
        Report an issue
      </a>
    </footer>
  );
}
