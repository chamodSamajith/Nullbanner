// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useState } from "preact/hooks";
import { Header } from "./components/Header";
import { SiteToggle } from "./components/SiteToggle";
import { StatsRow } from "./components/StatsRow";
import { Footer } from "./components/Footer";
import { sendMessage, type StatusResponse } from "../shared/messaging";

function getActiveTabHostname(): Promise<{ hostname: string; tabId: number | undefined }> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      try {
        const url = new URL(tab?.url ?? "");
        resolve({ hostname: url.hostname, tabId: tab?.id });
      } catch {
        resolve({ hostname: "", tabId: tab?.id });
      }
    });
  });
}

export function App() {
  const [hostname, setHostname] = useState("");
  const [tabId, setTabId] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [justToggledSite, setJustToggledSite] = useState(false);

  useEffect(() => {
    void (async () => {
      const { hostname: host, tabId: tid } = await getActiveTabHostname();
      setHostname(host);
      setTabId(tid);
      // Always resolve status, even with an empty hostname (e.g. the active
      // tab is a chrome:// or extension:// page) — otherwise the popup gets
      // stuck on "Loading…" forever.
      const result = await sendMessage<StatusResponse>({ type: "GET_STATUS", hostname: host });
      setStatus(result);
    })();
  }, []);

  const handleToggleGlobal = async () => {
    await sendMessage({ type: "TOGGLE_GLOBAL" });
    const result = await sendMessage<StatusResponse>({ type: "GET_STATUS", hostname });
    setStatus(result);
  };

  const handleToggleSite = async () => {
    if (!hostname) return;
    await sendMessage({ type: "TOGGLE_SITE", hostname });
    const result = await sendMessage<StatusResponse>({ type: "GET_STATUS", hostname });
    setStatus(result);
    setJustToggledSite(true);
  };

  const handleReload = () => {
    if (tabId !== undefined) chrome.tabs.reload(tabId);
    setJustToggledSite(false);
  };

  if (!status) {
    return (
      <div class="w-80 h-64 flex items-center justify-center bg-white dark:bg-slate-900">
        <span class="text-sm text-slate-400 dark:text-slate-500">Loading…</span>
      </div>
    );
  }

  return (
    <div class="w-80 bg-white dark:bg-slate-900">
      <Header globalEnabled={status.globalEnabled} onToggleGlobal={handleToggleGlobal} />
      <SiteToggle
        hostname={hostname || "No site loaded"}
        siteDisabled={status.siteDisabled}
        showReloadHint={justToggledSite}
        onToggleSite={handleToggleSite}
        onReload={handleReload}
        disabled={!hostname}
      />
      <StatsRow globalEnabled={status.globalEnabled} siteDisabled={status.siteDisabled} />
      <Footer hostname={hostname || "unknown"} version={status.version} />
    </div>
  );
}
