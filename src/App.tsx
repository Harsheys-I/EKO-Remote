import { lazy, Suspense, useEffect, useState } from "react";
import { ConnectionDialog } from "./components/ConnectionDialog";
import { Sidebar, Topbar } from "./components/Shell";
import type { ViewId } from "./components/Shell";
import { useEkoConnection } from "./hooks/useEkoConnection";
import { useMockHardware } from "./hooks/useMockHardware";
import { AIPage } from "./pages/AIPage";
import { ConfigPage } from "./pages/ConfigPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DrivePage } from "./pages/DrivePage";
import { LogsPage } from "./pages/LogsPage";
import { MemoryPage } from "./pages/MemoryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { VisionPage } from "./pages/VisionPage";
import { offlineState } from "./types";

const TerminalPage = lazy(() =>
  import("./pages/TerminalPage").then((module) => ({ default: module.TerminalPage })),
);

const views = new Set<ViewId>([
  "dashboard",
  "drive",
  "ai",
  "vision",
  "memory",
  "logs",
  "config",
  "terminal",
  "settings",
]);

const fromHash = (): ViewId => {
  const value = window.location.hash.replace(/^#\/?/, "") as ViewId;
  return views.has(value) ? value : "dashboard";
};

export default function App() {
  const [view, setView] = useState<ViewId>(fromHash);
  const [showConnection, setShowConnection] = useState(false);
  const connection = useEkoConnection();
  const mock = useMockHardware(connection.client, connection.profile, connection.stats, connection.applySettings);

  useEffect(() => {
    const sync = () => setView(fromHash());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => {
    if (!connection.stats.connected && !connection.stats.connecting && !connection.profile.autoReconnect) {
      setShowConnection(true);
    }
  }, [connection.profile.autoReconnect, connection.stats.connected, connection.stats.connecting]);
  useEffect(() => {
    if (connection.stats.error && !connection.stats.connected) setShowConnection(true);
  }, [connection.stats.connected, connection.stats.error]);

  const navigate = (next: ViewId) => {
    window.location.hash = next;
    setView(next);
  };
  const connect = async (profile: typeof connection.profile) => {
    await connection.connect(profile);
    setShowConnection(false);
  };
  const stop = async () => {
    try {
      await connection.client?.stop();
    } catch {
      // The robot's dead-man watchdog remains authoritative.
    } finally {
      void connection.refresh();
    }
  };
  const forget = async () => {
    await connection.disconnect();
    window.localStorage.removeItem("eko-remote-connection-v1");
    window.location.reload();
  };
  const state = connection.status?.state ?? offlineState;

  return <div className="app-shell">
    <Sidebar view={view} stats={connection.stats} onNavigate={navigate} />
    <main className="main-shell">
      <Topbar view={view} state={state} stats={connection.stats} onConnect={() => setShowConnection(true)} onDisconnect={() => void connection.disconnect()} onRefresh={() => void connection.refresh()} onStop={() => void stop()} />
      <div className="page-content">
        {view === "dashboard" && <DashboardPage status={connection.status} events={connection.events} stats={connection.stats} mock={mock} onNavigate={navigate} onConnect={() => setShowConnection(true)} />}
        {view === "drive" && <DrivePage client={connection.client} state={state} settings={connection.status?.settings ?? null} stats={connection.stats} mock={mock} onSettings={connection.applySettings} />}
        {view === "ai" && <AIPage client={connection.client} status={connection.status} events={connection.events} stats={connection.stats} onSettings={connection.applySettings} />}
        {view === "vision" && <VisionPage client={connection.client} status={connection.status} stats={connection.stats} onSettings={connection.applySettings} />}
        {view === "memory" && <MemoryPage client={connection.client} />}
        {view === "logs" && <LogsPage events={connection.events} stats={connection.stats} />}
        {view === "config" && <ConfigPage client={connection.client} />}
        {view === "terminal" && <Suspense fallback={<div className="page-loading">Loading secure terminal…</div>}><TerminalPage client={connection.client} profile={connection.profile} stats={connection.stats} /></Suspense>}
        {view === "settings" && <SettingsPage status={connection.status} stats={connection.stats} profile={connection.profile} onConnection={() => setShowConnection(true)} onForget={() => void forget()} />}
      </div>
    </main>
    <video ref={mock.videoRef} className="mock-capture-video" muted playsInline aria-hidden />
    <ConnectionDialog open={showConnection} profile={connection.profile} stats={connection.stats} bleSupported={connection.bleSupported} canClose onClose={() => setShowConnection(false)} onConnect={connect} />
  </div>;
}
