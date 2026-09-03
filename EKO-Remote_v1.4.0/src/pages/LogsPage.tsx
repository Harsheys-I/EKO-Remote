import { Activity, Download, Pause, Play, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EmptyState, Panel, SectionHeading } from "../components/Common";
import type { EkoEvent, LinkStats } from "../types";

type Group = "all" | "safety" | "motion" | "ai" | "hardware" | "system";

export function eventGroup(name: string): Exclude<Group, "all"> {
  if (/emergency|hazard|drop|lift|stale|collision|safety|error/.test(name)) return "safety";
  if (/^(?:motion|navigation|odometry|vision\.follow)/.test(name)) return "motion";
  if (/^(?:ai|conversation|camera\.question|memory|chat|workflow)/.test(name)) return "ai";
  if (/^(?:sensors|audio|eyes|vision|camera|speaker|spotify|hardware)/.test(name)) return "hardware";
  return "system";
}

function severity(event: EkoEvent) {
  const text = `${event.name} ${String(event.payload.error ?? "")}`.toLowerCase();
  if (/emergency|drop|collision|fatal|adapter_error/.test(text)) return "critical";
  if (/error|failed|unavailable|stale|hazard|warning/.test(text)) return "warning";
  if (/completed|connected|ready|started/.test(text)) return "success";
  return "info";
}

function summary(event: EkoEvent) {
  const preferred = ["reason", "status", "error", "category", "state", "destination", "source", "expression"];
  const fragments = preferred
    .filter((key) => event.payload[key] != null)
    .map((key) => `${key}: ${typeof event.payload[key] === "object" ? JSON.stringify(event.payload[key]) : String(event.payload[key])}`);
  if (fragments.length) return fragments.join(" · ").slice(0, 260);
  const keys = Object.keys(event.payload);
  return keys.length ? `${keys.length} field${keys.length === 1 ? "" : "s"}: ${keys.slice(0, 5).join(", ")}` : "No payload";
}

export function LogsPage({ events, stats }: { events: EkoEvent[]; stats: LinkStats }) {
  const [paused, setPaused] = useState(false);
  const [snapshot, setSnapshot] = useState(events);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<Group>("all");
  const [clearedAt, setClearedAt] = useState(0);
  useEffect(() => { if (!paused) setSnapshot(events); }, [events, paused]);

  const filtered = useMemo(() => {
    const normalized = query.toLowerCase();
    const telemetrySeen = new Set<string>();
    return [...snapshot].reverse().filter((event) => {
      if (new Date(event.timestamp).getTime() <= clearedAt) return false;
      if (group !== "all" && eventGroup(event.name) !== group) return false;
      if (normalized && !`${event.name} ${JSON.stringify(event.payload)} ${event.correlation_id ?? ""}`.toLowerCase().includes(normalized)) return false;
      const highFrequency = /^(?:sensors\.telemetry|odometry\.|eyes\.|vision\.person\.target|navigation\.control)/.test(event.name);
      if (!normalized && highFrequency) {
        if (telemetrySeen.has(event.name)) return false;
        telemetrySeen.add(event.name);
      }
      return true;
    }).slice(0, 300);
  }, [clearedAt, group, query, snapshot]);

  const counts = useMemo(() => snapshot.reduce<Record<string, number>>((value, event) => {
    const key = eventGroup(event.name); value[key] = (value[key] ?? 0) + 1; return value;
  }, {}), [snapshot]);
  const exportEvents = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(filtered, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `eko-events-${new Date().toISOString().replace(/[:.]/g, "-")}.json`; link.click(); URL.revokeObjectURL(url);
  };
  const clear = () => { setClearedAt(Date.now()); setSnapshot([]); };

  return <Panel className="logs-panel clean-logs"><SectionHeading kicker={`${stats.kind === "ble" ? "BLE" : "WEBSOCKET"} EVENT STREAM`} title={`${filtered.length} useful events`} action={<div className="heading-actions"><button className="secondary-button" onClick={() => setPaused((value) => !value)}>{paused ? <Play size={16} /> : <Pause size={16} />}{paused ? "Resume" : "Pause"}</button><button className="secondary-button" onClick={clear}><Trash2 size={16} />Clear view</button><button className="secondary-button" onClick={exportEvents} disabled={!filtered.length}><Download size={16} />Export</button></div>} />
    <div className="log-group-tabs">{(["all", "safety", "motion", "ai", "hardware", "system"] as Group[]).map((item) => <button key={item} className={group === item ? "active" : ""} onClick={() => setGroup(item)}>{item}<span>{item === "all" ? snapshot.length : counts[item] ?? 0}</span></button>)}</div>
    <div className="log-toolbar"><label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search event, summary, payload, or correlation ID" /></label><span className={`stream-state ${paused ? "paused" : ""}`}><i />{paused ? "Paused" : stats.connected ? "Live" : "Offline"}</span></div>
    <div className="event-card-list">{filtered.length ? filtered.map((event, index) => <details className={`event-card ${severity(event)}`} key={`${event.timestamp}-${event.name}-${index}`}><summary><i /><time>{new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time><div><strong>{event.name}</strong><p>{summary(event)}</p></div><span>{eventGroup(event.name)}</span></summary><div className="event-details"><dl><div><dt>Correlation</dt><dd>{event.correlation_id ?? "—"}</dd></div><div><dt>Timestamp</dt><dd>{new Date(event.timestamp).toLocaleString()}</dd></div></dl><pre>{JSON.stringify(event.payload, null, 2)}</pre></div></details>) : <EmptyState icon={Activity} title="No matching events" message="High-frequency telemetry is collapsed automatically. Expand any row to inspect its complete payload." />}</div>
  </Panel>;
}
