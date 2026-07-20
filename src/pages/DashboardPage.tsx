import { Activity, BatteryMedium, Bluetooth, BrainCircuit, Camera, Cpu, Gamepad2, HardDrive, MemoryStick, Mic2, Radio, ShieldCheck, Sparkles, Volume2, Wifi } from "lucide-react";
import { useEffect, useRef } from "react";
import { Metric, Panel, SectionHeading } from "../components/Common";
import type { ViewId } from "../components/Shell";
import type { MockHardwareController } from "../hooks/useMockHardware";
import type { EkoEvent, LinkStats, StatusPayload } from "../types";

function formatBytes(value: number | null | undefined) {
  if (value == null) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let amount = value;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) { amount /= 1024; unit += 1; }
  return `${amount >= 100 || unit === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[unit]}`;
}

function CameraPreview({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.srcObject = stream;
    if (stream) void ref.current.play().catch(() => undefined);
  }, [stream]);
  return <video ref={ref} muted playsInline aria-label="Live browser camera preview" />;
}

export function DashboardPage({ status, events, stats, mock, onNavigate, onConnect }: { status: StatusPayload | null; events: EkoEvent[]; stats: LinkStats; mock: MockHardwareController; onNavigate: (view: ViewId) => void; onConnect: () => void }) {
  const state = status?.state;
  const recent = events.slice(0, 6);
  return <div className="page-grid dashboard-page"><Panel className="system-hero"><div className="hero-copy"><span className="eyebrow">EKO / REMOTE MISSION CONTROL</span><h2>{stats.connected ? `${status?.robot.name ?? "EKO"} is ${state?.mode}` : "Your robot is one link away"}</h2><p>{stats.connected ? `Live control and telemetry are flowing over ${stats.kind === "ble" ? "Bluetooth Low Energy" : "Wi-Fi"}.` : "Connect over Wi-Fi for the fastest full-control link, or pair directly over BLE when a network is unavailable."}</p><div className="hero-actions">{stats.connected ? <><button onClick={() => onNavigate("drive")}><Gamepad2 size={17} />Drive EKO</button><button className="secondary" onClick={() => onNavigate("ai")}><BrainCircuit size={17} />Open AI</button></> : <button onClick={onConnect}><Radio size={17} />Connect now</button>}</div></div><div className={`core-visual ${stats.connected ? "online" : ""}`}><span className="core-ring ring-one" /><span className="core-ring ring-two" /><div>{stats.kind === "ble" ? <Bluetooth size={42} /> : stats.connected ? <Wifi size={42} /> : <BrainCircuit size={42} />}<strong>{stats.connected ? stats.kind : "offline"}</strong></div></div></Panel>
    <div className="metric-grid"><Metric icon={Cpu} label="CPU temperature" value={state?.health.cpu_temperature_c == null ? "—" : `${state.health.cpu_temperature_c}°C`} detail="Raspberry Pi" /><Metric icon={MemoryStick} label="Memory usage" value={state?.health.memory_usage_percent == null ? "—" : `${state.health.memory_usage_percent}%`} detail="System RAM" /><Metric icon={HardDrive} label="Storage used / total" value={`${formatBytes(state?.health.storage_used_bytes)} / ${formatBytes(state?.health.storage_total_bytes)}`} detail={state?.health.storage_usage_percent == null ? "Sampled once per minute" : `${state.health.storage_usage_percent}% • 1-minute sample`} /><Metric icon={BatteryMedium} label="Battery" value={state?.health.battery_percent == null ? "Not linked" : `${state.health.battery_percent}%`} detail="Power telemetry" /><Metric icon={stats.kind === "ble" ? Bluetooth : Radio} label="Control latency" value={stats.latencyMs == null ? "—" : `${stats.latencyMs} ms`} detail={stats.kind === "ble" ? "BLE GATT" : "HTTPS / WSS"} /></div>
    <Panel className="mock-panel"><SectionHeading kicker="BROWSER HARDWARE" title="Mock mode" action={<label className={`mock-master-switch ${mock.active ? "on" : ""}`}><input type="checkbox" checked={mock.active} disabled={!stats.connected || mock.connecting} onChange={(event) => void (event.target.checked ? mock.enable() : mock.disable()).catch(() => undefined)} /><i /><span>{mock.connecting ? "Starting" : mock.active ? "Active" : "Off"}</span></label>} /><div className="mock-layout"><div className={`mock-preview ${mock.devices.camera ? "ready" : ""}`}>{mock.stream && mock.devices.camera ? <CameraPreview stream={mock.stream} /> : <div><Camera size={28} /><span>Browser camera standby</span></div>}<span className="mock-live-chip">{mock.active ? "LIVE ADAPTER" : "LOCAL ONLY"}</span></div><div className="mock-device-list">{[[Mic2, "Microphone", mock.devices.microphone, "PCM → Pi wake word / STT"], [Camera, "Camera", mock.devices.camera, "JPEG on Pi request"], [Volume2, "Speaker", mock.devices.speaker, "Pi TTS → browser playback"], [Gamepad2, "Motors", mock.active, "Pi planner → top-down simulator"]].map(([Icon, label, ready, detail]) => { const DeviceIcon = Icon as typeof Mic2; return <div key={String(label)} className={ready ? "ready" : ""}><DeviceIcon size={17} /><span><strong>{String(label)}</strong><small>{String(detail)}</small></span><i /></div>; })}</div></div><p className="mock-explainer">Only the physical adapters are replaced. Wake-word detection, recording, STT, Groq, vision, motion planning, watchdogs, and Nano safety logic still execute on the Raspberry Pi.</p>{mock.error && <p className="inline-error">{mock.error}</p>}</Panel>
    <Panel className="behavior-panel"><SectionHeading kicker="BEHAVIOR" title="Live state" action={<Activity size={19} />} /><div className="signal-grid">{[["Listening", state?.listening], ["Thinking", state?.thinking], ["Speaking", state?.speaking], ["Moving", state?.moving]].map(([label, active]) => <div className={`signal ${active ? "active" : ""}`} key={String(label)}><i /><span>{String(label)}</span><strong>{active ? "Active" : "Standby"}</strong></div>)}</div></Panel>
    <Panel className="capabilities-panel"><SectionHeading kicker="ROBOT MODULES" title="Capabilities" action={<Sparkles size={19} />} /><div className="capability-list">{Object.entries(status?.capabilities ?? {}).map(([name, active]) => <div key={name}><span>{name.replaceAll("_", " ")}</span><strong className={active ? "ready" : "disabled"}>{active ? "Ready" : "Disabled"}</strong></div>)}</div></Panel>
    <Panel className="events-preview"><SectionHeading kicker="EVENT BUS" title="Recent activity" action={<button className="text-button" onClick={() => onNavigate("logs")}>View all</button>} /><div className="event-preview-list">{recent.length ? recent.map((event, index) => <article key={`${event.timestamp}-${index}`}><i /><time>{new Date(event.timestamp).toLocaleTimeString()}</time><strong>{event.name}</strong><code>{JSON.stringify(event.payload)}</code></article>) : <p className="muted-copy">No runtime events received yet.</p>}</div></Panel>
    <Panel className="safety-panel"><ShieldCheck size={23} /><div><span className="eyebrow">ROBOT-SIDE SAFETY</span><h3>{status?.settings.hardware_enabled ? "Hardware gate acknowledged" : "Motion hardware locked"}</h3><p>{status?.settings.hardware_enabled ? "Every drive vector is speed-limited and covered by EKO's dead-man watchdog." : "Hardware YAML changes are staged only; safety acknowledgement and a controlled EKO restart are still required."}</p></div></Panel>
  </div>;
}
