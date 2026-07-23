import { AudioLines, Bluetooth, Camera, Cpu, ExternalLink, Gauge, Link2, ShieldCheck, Trash2, Wifi } from "lucide-react";
import type { ConnectionProfile, LinkStats, StatusPayload } from "../types";
import { Panel, SectionHeading } from "../components/Common";

export function SettingsPage({
  status,
  stats,
  profile,
  onConnection,
  onForget,
}: {
  status: StatusPayload | null;
  stats: LinkStats;
  profile: ConnectionProfile;
  onConnection: () => void;
  onForget: () => void;
}) {
  const settings = status?.settings;

  return <div className="page-grid settings-page settings-page-clean">
    <Panel className="connection-settings">
      <SectionHeading kicker="ACTIVE LINK" title="Connection" action={stats.kind === "ble" ? <Bluetooth size={19} /> : <Wifi size={19} />} />
      <dl className="detail-list">
        <div><dt>Transport</dt><dd>{stats.kind === "ble" ? "Bluetooth LE" : stats.kind === "wifi" ? "Wi-Fi / HTTPS" : "Disconnected"}</dd></div>
        <div><dt>Endpoint/device</dt><dd className="endpoint-value">{stats.connected ? stats.label : profile.kind === "wifi" ? profile.wifiUrl : profile.bleDeviceId || "Not paired"}</dd></div>
        <div><dt>Latency</dt><dd>{stats.latencyMs == null ? "—" : `${stats.latencyMs} ms`}</dd></div>
        <div><dt>Last update</dt><dd>{stats.lastUpdated?.toLocaleTimeString() ?? "—"}</dd></div>
        <div><dt>Robot version</dt><dd>{status?.robot.version ?? "—"}</dd></div>
      </dl>
      <button className="connection-change" onClick={onConnection}><Link2 size={17} />Change connection</button>
      <button className="forget-button" onClick={onForget}><Trash2 size={16} />Forget saved link and token</button>
      <p className="config-hint"><ExternalLink size={16} />For GitHub Pages, use the private Tailscale HTTPS address created by EKO's setup script.</p>
    </Panel>

    <Panel className="module-settings">
      <SectionHeading kicker="DEVICE MODULES" title="Current startup state" action={<Cpu size={19} />} />
      <div className="module-grid">
        <article><Gauge size={20} /><div><strong>Motor drivers</strong><span>{settings?.motors_enabled ? "Enabled" : "Not installed / locked"}</span></div></article>
        <article><Camera size={20} /><div><strong>Vision</strong><span>{settings?.vision_enabled ? "Enabled" : "Disabled"}</span></div></article>
        <article><AudioLines size={20} /><div><strong>Audio</strong><span>{settings?.audio_enabled ? "Enabled" : "Disabled"}</span></div></article>
      </div>
      <div className="restart-note"><ShieldCheck size={19} /><p>All robot configuration fields—including every true/false switch—now live only in the Config page. Startup-managed fields will ask for a controlled restart when saved.</p></div>
    </Panel>
  </div>;
}
