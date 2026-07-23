import { Activity, Bluetooth, BrainCircuit, Bug, Camera, CircleStop, Database, FileCode2, Gamepad2, Gauge, Link2, Map, Radio, RefreshCw, Settings2, TerminalSquare, Unplug, Wifi } from "lucide-react";
import type { LinkStats, RobotState } from "../types";

export type ViewId = "dashboard" | "drive" | "ai" | "vision" | "memory" | "map" | "logs" | "config" | "terminal" | "settings";
const navigation = [
  { id: "dashboard" as const, label: "Dashboard", icon: Gauge }, { id: "drive" as const, label: "Drive", icon: Gamepad2 },
  { id: "ai" as const, label: "AI & Voice", icon: BrainCircuit }, { id: "vision" as const, label: "Vision", icon: Camera },
  { id: "memory" as const, label: "Memory", icon: Database }, { id: "logs" as const, label: "Logs", icon: Activity },
  { id: "map" as const, label: "House Map", icon: Map },
  { id: "config" as const, label: "Config", icon: FileCode2 },
  { id: "terminal" as const, label: "Terminal", icon: TerminalSquare },
  { id: "settings" as const, label: "Settings", icon: Settings2 },
];
const titles: Record<ViewId, [string, string]> = { dashboard: ["SYSTEM OVERVIEW", "Dashboard"], drive: ["MOTION SYSTEM", "Drive EKO"], ai: ["INTELLIGENCE", "AI & voice"], vision: ["PERCEPTION", "Vision"], memory: ["PERSISTENCE", "Memory bank"], map: ["SPATIAL MEMORY", "House map"], logs: ["OBSERVABILITY", "Runtime logs"], config: ["ROBOT CONFIGURATION", "Configuration"], terminal: ["SECURE ACCESS", "Pi terminal"], settings: ["REMOTE CONFIGURATION", "Remote settings"] };

export function Sidebar({ view, stats, onNavigate }: { view: ViewId; stats: LinkStats; onNavigate: (view: ViewId) => void }) {
  return <aside className="sidebar"><button className="wordmark" onClick={() => onNavigate("dashboard")}><strong>EKO</strong><span>REMOTE</span></button><nav>{navigation.map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? "selected" : ""} onClick={() => onNavigate(id)} title={label}><Icon size={18} /><span>{label}</span></button>)}</nav><div className={`side-link ${stats.connected ? "online" : ""}`}><i />{stats.kind === "ble" ? <Bluetooth size={15} /> : <Wifi size={15} />}<div><strong>{stats.connected ? "EKO online" : "Disconnected"}</strong><span>{stats.connected ? stats.label : "Connect to begin"}</span></div></div></aside>;
}

export function Topbar({ view, state, stats, debugEnabled, onDebugEnabled, onConnect, onDisconnect, onRefresh, onStop }: { view: ViewId; state: RobotState; stats: LinkStats; debugEnabled: boolean; onDebugEnabled: (enabled: boolean) => void; onConnect: () => void; onDisconnect: () => void; onRefresh: () => void; onStop: () => void }) {
  return <header className="topbar"><div><span className="eyebrow">{titles[view][0]}</span><h1>{titles[view][1]}</h1></div><div className="top-actions"><label className={`top-debug-switch ${debugEnabled ? "on" : ""}`} title="Show live structured logs from the Raspberry Pi"><input type="checkbox" checked={debugEnabled} onChange={(event) => onDebugEnabled(event.target.checked)} /><span className="switch-track"><i /></span><Bug size={14} /><span className="switch-copy"><strong>Debug mode</strong><small>{debugEnabled ? "Live logs" : "Off"}</small></span></label><span className={`link-chip ${stats.connected ? "online" : ""}`}>{stats.kind === "ble" ? <Bluetooth size={14} /> : <Radio size={14} />}{stats.connected ? `${stats.latencyMs ?? "—"} ms` : stats.connecting ? "Connecting" : "No link"}</span><span className={`mode-chip mode-${state.mode}`}><i />{state.mode}</span>{stats.connected ? <button className="icon-button" onClick={onRefresh} title="Refresh"><RefreshCw size={16} /></button> : null}<button className="connect-button" onClick={stats.connected ? onDisconnect : onConnect}>{stats.connected ? <Unplug size={16} /> : <Link2 size={16} />}{stats.connected ? "Disconnect" : "Connect"}</button><button className="stop-button" onClick={onStop} disabled={!stats.connected}><CircleStop size={17} />Stop</button></div></header>;
}
