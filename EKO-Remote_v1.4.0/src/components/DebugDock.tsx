import { Bug, CirclePause, CirclePlay, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DebugLogEntry, LinkStats, StatusPayload } from "../types";

const levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] as const;

function clock(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? timestamp
    : date.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function DebugDock({
  logs,
  status,
  stats,
}: {
  logs: DebugLogEntry[];
  status: StatusPayload | null;
  stats: LinkStats;
}) {
  const [paused, setPaused] = useState(false);
  const [pausedThrough, setPausedThrough] = useState<number | null>(null);
  const [minimumLevel, setMinimumLevel] = useState<(typeof levels)[number]>("DEBUG");
  const [clearedThrough, setClearedThrough] = useState(0);
  const streamRef = useRef<HTMLDivElement>(null);
  const threshold = levels.indexOf(minimumLevel);
  const visible = useMemo(
    () => logs.filter((entry) => entry.sequence > clearedThrough && levels.indexOf(entry.level as (typeof levels)[number]) >= threshold),
    [clearedThrough, logs, threshold],
  );
  const rendered = paused && pausedThrough !== null
    ? visible.filter((entry) => entry.sequence <= pausedThrough)
    : visible;
  const workflows = status?.capability_status?.workflows;

  useEffect(() => {
    if (paused) return;
    const node = streamRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [paused, rendered.length]);

  return <aside className="debug-dock">
    <header>
      <div><span className="eyebrow">LIVE RUNTIME</span><strong>Debug console</strong></div>
      <Bug size={18} />
    </header>
    <div className="debug-summary">
      <span className={stats.connected ? "online" : ""}><i />{stats.connected ? "STREAMING" : "OFFLINE"}</span>
      <span>{logs.length} buffered</span>
      <span>{workflows?.active.length ?? 0} workflows</span>
    </div>
    <div className="debug-toolbar">
      <label>
        <span>Minimum level</span>
        <select value={minimumLevel} onChange={(event) => setMinimumLevel(event.target.value as (typeof levels)[number])}>
          {levels.map((level) => <option key={level}>{level}</option>)}
        </select>
      </label>
      <button className="icon-button" onClick={() => {
        setPaused((value) => {
          const next = !value;
          setPausedThrough(next ? (logs.at(-1)?.sequence ?? 0) : null);
          return next;
        });
      }} title={paused ? "Resume live logs" : "Pause live logs"}>
        {paused ? <CirclePlay size={15} /> : <CirclePause size={15} />}
      </button>
      <button className="icon-button" onClick={() => setClearedThrough(logs.at(-1)?.sequence ?? 0)} title="Clear visible logs">
        <Trash2 size={15} />
      </button>
    </div>
    <div className="debug-stream" ref={streamRef} role="log" aria-live={paused ? "off" : "polite"}>
      {rendered.length ? rendered.map((entry) => <article className={`debug-row level-${entry.level.toLowerCase()}`} key={entry.sequence}>
        <div><time>{clock(entry.timestamp)}</time><strong>{entry.level}</strong><span>#{entry.sequence}</span></div>
        <p>{entry.message}</p>
        <small>{entry.logger} · {entry.thread}</small>
        {entry.exception && <pre>{entry.exception}</pre>}
      </article>) : <div className="debug-empty"><Bug size={20} /><strong>{paused ? "Stream paused" : stats.connected ? "Waiting for records" : "Connect to EKO"}</strong><span>Pi DEBUG, INFO, WARNING, and ERROR records appear here.</span></div>}
    </div>
  </aside>;
}
