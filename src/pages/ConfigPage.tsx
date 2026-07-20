import { AlertTriangle, CheckCircle2, Copy, FileSliders, RefreshCw, RotateCcw, Save, ServerCog, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { EkoClient } from "../client";
import { EmptyState, Panel, SectionHeading, Toggle } from "../components/Common";
import { WifiProfilesEditor } from "../components/WifiProfilesEditor";
import type { ConfigField, ConfigFile } from "../types";

type FieldValues = Record<string, unknown>;
type Drafts = Record<string, FieldValues>;
type SavePhase = "idle" | "validating" | "applying";

interface RestartNotice {
  files: string[];
  command: string;
  backups: Record<string, string>;
}

const valuesFor = (file: ConfigFile): FieldValues => Object.fromEntries(file.fields.map((field) => [field.path, field.value]));
const draftsFor = (files: ConfigFile[]): Drafts => Object.fromEntries(files.map((file) => [file.name, valuesFor(file)]));
const sameValue = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

function FieldControl({ field, value, disabled, onChange }: { field: ConfigField; value: unknown; disabled: boolean; onChange: (value: unknown) => void }) {
  if (field.read_only) return <div className="env-managed"><code>{field.environment_name}</code><span>Managed in .env on the Raspberry Pi</span></div>;
  if (field.type === "boolean") return <Toggle checked={Boolean(value)} label={field.label} description={field.path} disabled={disabled} onChange={onChange} />;
  if (field.options.length) return <label className="config-control"><span>{field.label}</span><small>{field.path}</small><select value={String(value ?? "")} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{field.options.map((option) => <option key={String(option)} value={String(option)}>{String(option)}</option>)}</select></label>;
  if (field.type === "integer" || field.type === "number") return <label className="config-control"><span>{field.label}</span><small>{field.path}</small><input type="number" step={field.type === "integer" ? 1 : "any"} min={field.minimum ?? undefined} max={field.maximum ?? undefined} value={value == null ? "" : String(value)} disabled={disabled} onChange={(event) => onChange(event.target.value === "" && field.nullable ? null : Number(event.target.value))} /></label>;
  if (field.type === "array") return <label className="config-control"><span>{field.label}</span><small>{field.path} · comma separated</small><input value={Array.isArray(value) ? value.join(", ") : ""} disabled={disabled} onChange={(event) => onChange(event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} /></label>;
  const text = String(value ?? "");
  const multiline = text.length > 90 || /(?:prompt|format)$/i.test(field.path);
  return <label className={`config-control ${multiline ? "wide" : ""}`}><span>{field.label}</span><small>{field.path}</small>{multiline ? <textarea rows={5} value={text} disabled={disabled} onChange={(event) => onChange(event.target.value)} /> : <input value={text} disabled={disabled} onChange={(event) => onChange(event.target.value)} />}</label>;
}

export function ConfigPage({ client }: { client: EkoClient | null }) {
  const [files, setFiles] = useState<ConfigFile[]>([]);
  const [selectedName, setSelectedName] = useState("");
  const [drafts, setDrafts] = useState<Drafts>({});
  const [baselines, setBaselines] = useState<Drafts>({});
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<SavePhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [restartNotice, setRestartNotice] = useState<RestartNotice | null>(null);
  const [copied, setCopied] = useState(false);

  const selected = useMemo(() => files.find((file) => file.name === selectedName) ?? null, [files, selectedName]);
  const changes = useMemo(() => {
    const result: Record<string, Record<string, unknown>> = {};
    files.forEach((file) => {
      const changed = Object.fromEntries(Object.entries(drafts[file.name] ?? {}).filter(([path, value]) => !sameValue(value, baselines[file.name]?.[path])));
      if (Object.keys(changed).length) result[file.name] = changed;
    });
    return result;
  }, [baselines, drafts, files]);
  const dirtyFiles = Object.keys(changes);
  const dirtyFields = Object.values(changes).reduce((total, values) => total + Object.keys(values).length, 0);
  const grouped = useMemo(() => {
    const groups = new Map<string, ConfigField[]>();
    selected?.fields.forEach((field) => groups.set(field.group, [...(groups.get(field.group) ?? []), field]));
    return [...groups.entries()];
  }, [selected]);

  const installFiles = useCallback((nextFiles: ConfigFile[], preferred = "") => {
    setFiles(nextFiles);
    const nextDrafts = draftsFor(nextFiles);
    setDrafts(nextDrafts);
    setBaselines(nextDrafts);
    setSelectedName(nextFiles.some((file) => file.name === preferred) ? preferred : nextFiles[0]?.name ?? "");
  }, []);

  const load = useCallback(async (force = false) => {
    if (!client) return;
    if (!force && dirtyFields && !window.confirm("Discard all staged configuration changes and reload from EKO?")) return;
    setLoading(true); setError(null); setSuccess(null); setWarnings([]);
    try { installFiles((await client.configFiles()).files, selectedName); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load EKO configuration"); }
    finally { setLoading(false); }
  }, [client, dirtyFields, installFiles, selectedName]);

  useEffect(() => {
    if (!client) { setFiles([]); setDrafts({}); setBaselines({}); setSelectedName(""); return; }
    void load(true);
    // Connection is the load boundary; drafts stay local while navigating files.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  const updateField = (fileName: string, path: string, value: unknown) => {
    setDrafts((current) => ({ ...current, [fileName]: { ...current[fileName], [path]: value } }));
    setError(null); setSuccess(null); setWarnings([]);
  };

  const applyAll = async () => {
    if (!client || !dirtyFields) return;
    setError(null); setSuccess(null); setWarnings([]); setPhase("validating");
    try {
      const validation = await client.validateConfigBatch(changes);
      setWarnings(validation.warnings);
      if (!validation.valid) throw new Error("EKO rejected the candidate configuration");
      setPhase("applying");
      const applied = await client.applyConfigBatch(changes);
      if (applied.files) installFiles(applied.files, selectedName);
      else installFiles((await client.configFiles()).files, selectedName);
      setWarnings(applied.warnings);
      if (applied.restart_required) {
        setRestartNotice({ files: applied.restart_files, command: applied.restart_command || "sudo systemctl restart eko", backups: applied.backup_names });
        setSuccess(`${applied.changed_paths.length} fields passed validation and were saved atomically. Restart EKO for startup-bound fields.`);
      } else {
        setSuccess(`${applied.changed_paths.length} fields passed validation and were applied live.`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not validate and apply configuration");
    } finally { setPhase("idle"); }
  };

  const discardSelected = () => {
    if (!selected) return;
    setDrafts((current) => ({ ...current, [selected.name]: { ...baselines[selected.name] } }));
    setError(null); setSuccess(null); setWarnings([]);
  };
  const discardAll = () => { setDrafts(structuredClone(baselines)); setError(null); setSuccess(null); setWarnings([]); };
  const copyRestart = async () => {
    if (!restartNotice) return;
    await navigator.clipboard.writeText(restartNotice.command);
    setCopied(true); window.setTimeout(() => setCopied(false), 1600);
  };

  if (!client) return <Panel className="config-empty"><EmptyState icon={ServerCog} title="Connect to edit configuration" message="EKO exposes fixed, typed controls for its Raspberry Pi configuration after authentication." /></Panel>;

  const busy = phase !== "idle";
  return <div className="page-grid config-page">
    <div className={`config-batch-bar ${dirtyFields ? "dirty" : ""}`}><div><ShieldCheck size={20} /><span><strong>{dirtyFields ? `${dirtyFields} staged field${dirtyFields === 1 ? "" : "s"} across ${dirtyFiles.length} file${dirtyFiles.length === 1 ? "" : "s"}` : "Configuration matches EKO"}</strong><small>{dirtyFields ? "Nothing is written until the complete candidate passes server-side validation." : "Make any number of changes, then apply them together."}</small></span></div><div>{dirtyFields > 0 && <button className="secondary-button" disabled={busy} onClick={discardAll}><RotateCcw size={16} />Discard all</button>}<button className="primary-button" disabled={!dirtyFields || busy} onClick={() => void applyAll()}><Save size={16} />{phase === "validating" ? "Validating all…" : phase === "applying" ? "Applying atomically…" : "Validate & apply all"}</button></div></div>
    <Panel className="config-browser"><SectionHeading kicker="CONFIGURATION" title="System areas" action={<button className="icon-button" onClick={() => void load()} disabled={loading || busy} title="Reload configuration"><RefreshCw className={loading ? "spin" : ""} size={17} /></button>} /><div className="config-file-list">{files.map((file) => { const count = Object.keys(changes[file.name] ?? {}).length; return <button key={file.name} className={file.name === selectedName ? "selected" : ""} onClick={() => setSelectedName(file.name)}><FileSliders size={17} /><span><strong>{file.title}</strong><small>{count ? `${count} staged` : `${file.fields.length} fixed fields`}</small></span>{count ? <i className="dirty-dot" /> : file.restart_required ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}</button>; })}</div><p className="config-security-note">Field names and types are locked by EKO. API keys remain in <code>.env</code>; saved Wi-Fi passwords are write-only and never returned.</p></Panel>
    <Panel className="config-editor"><SectionHeading kicker={selected?.name ?? "ROBOT CONFIG"} title={selected?.title ?? "Select an area"} action={selected && <span className="config-apply-chip">Staged editor</span>} />{selected && <p className="config-description">{selected.description}</p>}{error && <p className="inline-error">{error}</p>}{success && <p className="inline-success"><CheckCircle2 size={15} />{success}</p>}{warnings.map((warning) => <p className="inline-warning" key={warning}><AlertTriangle size={15} />{warning}</p>)}<div className="config-form">{grouped.map(([group, fields]) => <section className="config-group" key={group}><header><div><strong>{group === "General" ? "General" : group.split(".").map((item) => item.replaceAll("_", " ")).join(" / ")}</strong><span>{fields.length} fields</span></div></header><div className="config-field-grid">{fields.map((field) => <div className={`config-field ${field.type === "boolean" ? "boolean" : ""}`} key={field.path}><FieldControl field={field} value={selected ? drafts[selected.name]?.[field.path] : undefined} disabled={busy} onChange={(value) => selected && updateField(selected.name, field.path, value)} />{field.restart_required && <span className="field-restart"><AlertTriangle size={12} />Applies after restart</span>}</div>)}</div></section>)}</div>{selected?.name === "wifi.yaml" && <WifiProfilesEditor client={client} />}<footer className="config-editor-footer"><div>{selected && <><span>{selected.fields.length} fixed fields</span>{changes[selected.name] && <strong>{Object.keys(changes[selected.name]).length} staged in this file</strong>}</>}</div><button className="secondary-button" disabled={!selected || !changes[selected.name] || busy} onClick={discardSelected}><RotateCcw size={16} />Discard this file</button></footer></Panel>
    {restartNotice && <div className="modal-backdrop"><section className="restart-dialog" role="dialog" aria-modal="true" aria-labelledby="restart-title"><span className="restart-icon"><AlertTriangle size={24} /></span><div><span className="eyebrow">ATOMIC UPDATE SAVED</span><h2 id="restart-title">Restart EKO to apply startup fields</h2><p>The validated batch changed <strong>{restartNotice.files.join(", ")}</strong>. Backups were created for every changed file.</p><div className="backup-list">{Object.entries(restartNotice.backups).map(([file, backup]) => <span key={file}><strong>{file}</strong><code>{backup}</code></span>)}</div><code className="restart-command">{restartNotice.command}</code><div className="restart-actions"><button className="secondary-button" onClick={() => void copyRestart()}><Copy size={16} />{copied ? "Copied" : "Copy command"}</button><button className="primary-button" onClick={() => setRestartNotice(null)}>Understood</button></div></div></section></div>}
  </div>;
}
