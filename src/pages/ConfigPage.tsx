import { AlertTriangle, CheckCircle2, Copy, FileSliders, RefreshCw, RotateCcw, Save, ServerCog } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { EkoClient } from "../client";
import { EmptyState, Panel, SectionHeading, Toggle } from "../components/Common";
import { WifiProfilesEditor } from "../components/WifiProfilesEditor";
import type { ConfigField, ConfigFile } from "../types";

interface RestartNotice {
  fileName: string;
  command: string;
  backupName: string;
}

type FieldValues = Record<string, unknown>;

const valuesFor = (file: ConfigFile | null): FieldValues => Object.fromEntries(
  (file?.fields ?? []).map((field) => [field.path, field.value]),
);

const sameValue = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

function FieldControl({ field, value, disabled, onChange }: { field: ConfigField; value: unknown; disabled: boolean; onChange: (value: unknown) => void }) {
  if (field.read_only) {
    return <div className="env-managed"><code>{field.environment_name}</code><span>Managed in .env on the Raspberry Pi</span></div>;
  }
  if (field.type === "boolean") {
    return <Toggle checked={Boolean(value)} label={field.label} description={field.path} disabled={disabled} onChange={onChange} />;
  }
  if (field.options.length) {
    return <label className="config-control"><span>{field.label}</span><small>{field.path}</small><select value={String(value ?? "")} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{field.options.map((option) => <option key={String(option)} value={String(option)}>{String(option)}</option>)}</select></label>;
  }
  if (field.type === "integer" || field.type === "number") {
    return <label className="config-control"><span>{field.label}</span><small>{field.path}</small><input type="number" step={field.type === "integer" ? 1 : "any"} min={field.minimum ?? undefined} max={field.maximum ?? undefined} value={value == null ? "" : String(value)} disabled={disabled} onChange={(event) => onChange(event.target.value === "" && field.nullable ? null : Number(event.target.value))} /></label>;
  }
  if (field.type === "array") {
    return <label className="config-control"><span>{field.label}</span><small>{field.path} · comma separated</small><input value={Array.isArray(value) ? value.join(", ") : ""} disabled={disabled} onChange={(event) => onChange(event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} /></label>;
  }
  const text = String(value ?? "");
  const multiline = text.length > 90 || /(?:prompt|format)$/i.test(field.path);
  return <label className={`config-control ${multiline ? "wide" : ""}`}><span>{field.label}</span><small>{field.path}</small>{multiline ? <textarea rows={5} value={text} disabled={disabled} onChange={(event) => onChange(event.target.value)} /> : <input value={text} disabled={disabled} onChange={(event) => onChange(event.target.value)} />}</label>;
}

export function ConfigPage({ client }: { client: EkoClient | null }) {
  const [files, setFiles] = useState<ConfigFile[]>([]);
  const [selectedName, setSelectedName] = useState("");
  const [draft, setDraft] = useState<FieldValues>({});
  const [baseline, setBaseline] = useState<FieldValues>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [restartNotice, setRestartNotice] = useState<RestartNotice | null>(null);
  const [copied, setCopied] = useState(false);

  const selected = useMemo(() => files.find((file) => file.name === selectedName) ?? null, [files, selectedName]);
  const changedValues = useMemo(() => Object.fromEntries(Object.entries(draft).filter(([path, value]) => !sameValue(value, baseline[path]))), [baseline, draft]);
  const dirty = Object.keys(changedValues).length > 0;
  const grouped = useMemo(() => {
    const groups = new Map<string, ConfigField[]>();
    selected?.fields.forEach((field) => groups.set(field.group, [...(groups.get(field.group) ?? []), field]));
    return [...groups.entries()];
  }, [selected]);

  const selectFile = useCallback((file: ConfigFile) => {
    setSelectedName(file.name);
    const next = valuesFor(file);
    setDraft(next);
    setBaseline(next);
    setError(null);
    setSuccess(null);
  }, []);

  const load = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await client.configFiles();
      setFiles(payload.files);
      const next = payload.files.find((file) => file.name === selectedName) ?? payload.files[0];
      if (next) selectFile(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load EKO configuration");
    } finally {
      setLoading(false);
    }
  }, [client, selectFile, selectedName]);

  useEffect(() => {
    if (!client) {
      setFiles([]);
      setSelectedName("");
      return;
    }
    void load();
    // The connection change is the loading boundary; selecting a file is local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  const choose = (file: ConfigFile) => {
    if (dirty && !window.confirm("Discard the unsaved configuration changes?")) return;
    selectFile(file);
  };

  const save = async () => {
    if (!client || !selected || !dirty) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await client.updateConfig(selected.name, changedValues);
      setFiles((current) => current.map((file) => file.name === selected.name ? result.file : file));
      selectFile(result.file);
      if (result.file.restart_required) {
        setRestartNotice({ fileName: result.file.name, command: result.restart_command || "sudo systemctl restart eko", backupName: result.file.backup_name });
        setSuccess(`${result.file.title} saved. Restart EKO to apply the startup-bound fields.`);
      } else if (result.file.name === "wifi.yaml") {
        setSuccess(`${result.file.title} saved for the next boot-time recovery run.`);
      } else {
        setSuccess(`${result.file.title} saved and applied live.`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update configuration");
    } finally {
      setSaving(false);
    }
  };

  const copyRestart = async () => {
    if (!restartNotice) return;
    await navigator.clipboard.writeText(restartNotice.command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  if (!client) {
    return <Panel className="config-empty"><EmptyState icon={ServerCog} title="Connect to edit configuration" message="EKO exposes fixed, typed controls for its Raspberry Pi configuration after authentication." /></Panel>;
  }

  return <div className="page-grid config-page">
    <Panel className="config-browser">
      <SectionHeading kicker="CONFIGURATION" title="System areas" action={<button className="icon-button" onClick={() => void load()} disabled={loading || dirty} title={dirty ? "Save or discard changes before reloading" : "Reload configuration"}><RefreshCw className={loading ? "spin" : ""} size={17} /></button>} />
      <div className="config-file-list">{files.map((file) => <button key={file.name} className={file.name === selectedName ? "selected" : ""} onClick={() => choose(file)}><FileSliders size={17} /><span><strong>{file.title}</strong><small>{file.fields.length} fixed fields</small></span>{file.restart_required ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}</button>)}</div>
      <p className="config-security-note">Field names and types are locked by EKO. API keys remain in <code>.env</code>; saved Wi-Fi passwords are write-only and are never returned to this website.</p>
    </Panel>

    <Panel className="config-editor">
      <SectionHeading kicker={selected?.name ?? "ROBOT CONFIG"} title={selected?.title ?? "Select an area"} action={selected && <span className="config-apply-chip">Typed controls</span>} />
      {selected && <p className="config-description">{selected.description}</p>}
      {error && <p className="inline-error">{error}</p>}
      {success && <p className="inline-success"><CheckCircle2 size={15} />{success}</p>}
      <div className="config-form">{grouped.map(([group, fields]) => <section className="config-group" key={group}><header><div><strong>{group === "General" ? "General" : group.split(".").map((item) => item.replaceAll("_", " ")).join(" / ")}</strong><span>{fields.length} fields</span></div></header><div className="config-field-grid">{fields.map((field) => <div className={`config-field ${field.type === "boolean" ? "boolean" : ""}`} key={field.path}><FieldControl field={field} value={draft[field.path]} disabled={saving} onChange={(value) => setDraft((current) => ({ ...current, [field.path]: value }))} />{field.restart_required && <span className="field-restart"><AlertTriangle size={12} />Applies after restart</span>}</div>)}</div></section>)}</div>
      {selected?.name === "wifi.yaml" && <WifiProfilesEditor client={client} />}
      <footer className="config-editor-footer"><div>{selected && <><span>{selected.fields.length} fixed fields</span>{dirty && <strong>{Object.keys(changedValues).length} unsaved</strong>}</>}</div><button className="secondary-button" disabled={!dirty || saving} onClick={() => { setDraft({ ...baseline }); setError(null); }}><RotateCcw size={16} />Discard</button><button className="primary-button" disabled={!dirty || saving} onClick={() => void save()}><Save size={16} />{saving ? "Validating..." : "Save changes"}</button></footer>
    </Panel>

    {restartNotice && <div className="modal-backdrop"><section className="restart-dialog" role="dialog" aria-modal="true" aria-labelledby="restart-title"><span className="restart-icon"><AlertTriangle size={24} /></span><div><span className="eyebrow">CONFIGURATION SAVED</span><h2 id="restart-title">Restart EKO to apply these fields</h2><p><strong>{restartNotice.fileName}</strong> changed a startup-managed component. EKO created backup <code>{restartNotice.backupName}</code>.</p><code className="restart-command">{restartNotice.command}</code><div className="restart-actions"><button className="secondary-button" onClick={() => void copyRestart()}><Copy size={16} />{copied ? "Copied" : "Copy command"}</button><button className="primary-button" onClick={() => setRestartNotice(null)}>Understood</button></div></div></section></div>}
  </div>;
}
