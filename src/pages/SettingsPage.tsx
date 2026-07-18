import { AlertTriangle, AudioLines, Bluetooth, Camera, CheckCircle2, Copy, Cpu, ExternalLink, Gauge, Link2, RefreshCw, RotateCcw, ShieldCheck, Trash2, Wifi } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { EkoClient } from "../client";
import { Panel, SectionHeading, Toggle } from "../components/Common";
import type { ConfigFile, ConnectionProfile, LinkStats, RuntimeSettings, StatusPayload } from "../types";

export function SettingsPage({ client, status, stats, profile, onSettings, onConnection, onForget }: { client: EkoClient | null; status: StatusPayload | null; stats: LinkStats; profile: ConnectionProfile; onSettings: (settings: RuntimeSettings) => void; onConnection: () => void; onForget: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [configFiles, setConfigFiles] = useState<ConfigFile[]>([]);
  const [configBusy, setConfigBusy] = useState("");
  const [restartCommand, setRestartCommand] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const settings = status?.settings;

  const loadConfig = useCallback(async () => {
    if (!client) return;
    try {
      setConfigFiles((await client.configFiles()).files);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load configuration switches");
    }
  }, [client]);

  useEffect(() => {
    if (!client) {
      setConfigFiles([]);
      return;
    }
    void loadConfig();
  }, [client, loadConfig]);

  const update = async (changes: Partial<RuntimeSettings>) => {
    if (!client) return;
    try {
      onSettings(await client.updateSettings(changes));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update setting");
    }
  };

  const updateConfigBoolean = async (file: ConfigFile, path: string, value: boolean, restartRequired: boolean) => {
    if (!client) return;
    if (restartRequired && !window.confirm("This switch controls a startup-bound component. Save it now and restart EKO when ready?")) return;
    const busyKey = `${file.name}:${path}`;
    setConfigBusy(busyKey);
    setError(null);
    try {
      const result = await client.updateConfig(file.name, { [path]: value });
      setConfigFiles((current) => current.map((item) => item.name === file.name ? result.file : item));
      if (result.restart_command) setRestartCommand(result.restart_command);
      else onSettings(await client.settings());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update configuration switch");
    } finally {
      setConfigBusy("");
    }
  };

  const copyRestart = async () => {
    if (!restartCommand) return;
    await navigator.clipboard.writeText(restartCommand);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const booleanGroups = configFiles.map((file) => ({ file, fields: file.fields.filter((field) => field.type === "boolean" && !field.read_only) })).filter((group) => group.fields.length);

  return <div className="page-grid settings-page">
    <Panel className="runtime-settings">
      <SectionHeading kicker="RUNTIME BEHAVIOR" title="Operator preferences" action={<RotateCcw size={19} />} />
      {error && <p className="inline-error">{error}</p>}
      <Toggle checked={Boolean(settings?.voice_responses)} label="Voice responses" description="Speak replies through EKO" disabled={!client} onChange={(value) => void update({ voice_responses: value })} />
      <Toggle checked={Boolean(settings?.wakeword_enabled)} label="Wake-word listener" description="Allow event-driven microphone activation" disabled={!client || !settings?.audio_enabled} onChange={(value) => void update({ wakeword_enabled: value })} />
      <Toggle checked={false} label="Stateless CHAT" description="Past messages are never sent to Groq; only MEMORY receives saved user facts" disabled onChange={() => undefined} />
      <Toggle checked={Boolean(settings?.web_search_enabled)} label="Web search service" description="Permit current-information requests" disabled={!client} onChange={(value) => void update({ web_search_enabled: value })} />
      <Toggle checked={Boolean(settings?.camera_on_demand)} label="Camera capture" description="Permit explicit snapshots" disabled={!client || !settings?.vision_enabled} onChange={(value) => void update({ camera_on_demand: value })} />
    </Panel>

    <Panel className="connection-settings">
      <SectionHeading kicker="ACTIVE LINK" title="Connection" action={stats.kind === "ble" ? <Bluetooth size={19} /> : <Wifi size={19} />} />
      <dl className="detail-list"><div><dt>Transport</dt><dd>{stats.kind === "ble" ? "Bluetooth LE" : stats.kind === "wifi" ? "Wi-Fi / HTTPS" : "Disconnected"}</dd></div><div><dt>Endpoint/device</dt><dd className="endpoint-value">{stats.connected ? stats.label : profile.kind === "wifi" ? profile.wifiUrl : profile.bleDeviceId || "Not paired"}</dd></div><div><dt>Latency</dt><dd>{stats.latencyMs == null ? "—" : `${stats.latencyMs} ms`}</dd></div><div><dt>Last update</dt><dd>{stats.lastUpdated?.toLocaleTimeString() ?? "—"}</dd></div><div><dt>Robot version</dt><dd>{status?.robot.version ?? "—"}</dd></div></dl>
      <button className="connection-change" onClick={onConnection}><Link2 size={17} />Change connection</button>
      <button className="forget-button" onClick={onForget}><Trash2 size={16} />Forget saved link and token</button>
      <p className="config-hint"><ExternalLink size={16} />For GitHub Pages, use the private Tailscale HTTPS address created by EKO's setup script.</p>
    </Panel>

    <Panel className="boolean-settings">
      <SectionHeading kicker="ALL YAML SWITCHES" title="Feature switchboard" action={<button className="icon-button" onClick={() => void loadConfig()} disabled={!client || Boolean(configBusy)} title="Reload switches"><RefreshCw className={configBusy ? "spin" : ""} size={16} /></button>} />
      <p className="settings-intro">Every true/false field is represented here. Live fields apply immediately; hardware and process initialization remain restart-managed for safety.</p>
      {restartCommand && <div className="pending-restart"><AlertTriangle size={18} /><div><strong>Restart pending</strong><span>The saved startup configuration will apply after EKO restarts.</span></div><button className="secondary-button" onClick={() => void copyRestart()}><Copy size={15} />{copied ? "Copied" : "Copy restart command"}</button></div>}
      <div className="boolean-config-groups">{booleanGroups.map(({ file, fields }) => <section key={file.name}><header><div><strong>{file.title}</strong><span>{file.name}</span></div><small>{fields.length} switches</small></header><div>{fields.map((field) => { const busyKey = `${file.name}:${field.path}`; return <div className="config-switch" key={field.path}><Toggle checked={Boolean(field.value)} label={field.label} description={field.path} disabled={!client || Boolean(configBusy)} onChange={(value) => void updateConfigBoolean(file, field.path, value, field.restart_required)} />{field.restart_required ? <span className="switch-state restart"><AlertTriangle size={11} />Restart</span> : <span className="switch-state live"><CheckCircle2 size={11} />Live</span>}{configBusy === busyKey && <RefreshCw className="switch-saving spin" size={14} />}</div>; })}</div></section>)}</div>
    </Panel>

    <Panel className="module-settings">
      <SectionHeading kicker="DEVICE MODULES" title="Current startup state" action={<Cpu size={19} />} />
      <div className="module-grid"><article><Gauge size={20} /><div><strong>Motion hardware</strong><span>{settings?.hardware_enabled ? "Enabled" : "Safety locked"}</span></div></article><article><Camera size={20} /><div><strong>Vision</strong><span>{settings?.vision_enabled ? "Enabled" : "Disabled"}</span></div></article><article><AudioLines size={20} /><div><strong>Audio</strong><span>{settings?.audio_enabled ? "Enabled" : "Disabled"}</span></div></article></div>
      <div className="restart-note"><ShieldCheck size={19} /><p>GPIO, camera, audio engines, listener ports, and credentials are initialized deliberately. Their switches are still editable above, but EKO asks for a controlled restart before changing those live objects.</p></div>
    </Panel>
  </div>;
}
