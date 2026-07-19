import { EyeOff, KeyRound, Plus, RefreshCw, Save, Trash2, Wifi } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { EkoClient } from "../client";
import type { WifiRecoveryProfileDraft } from "../types";

const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) => byte.toString(16).padStart(2, "0")).join("");

const comparable = (profiles: WifiRecoveryProfileDraft[]) => profiles.map(({ id, ssid, priority, password_set, password, clear_password }) => ({
  id,
  ssid,
  priority,
  password_set,
  password: password || "",
  clear_password: Boolean(clear_password),
}));

export function WifiProfilesEditor({ client }: { client: EkoClient }) {
  const [profiles, setProfiles] = useState<WifiRecoveryProfileDraft[]>([]);
  const [baseline, setBaseline] = useState<WifiRecoveryProfileDraft[]>([]);
  const [maxProfiles, setMaxProfiles] = useState(20);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const dirty = useMemo(() => JSON.stringify(comparable(profiles)) !== JSON.stringify(comparable(baseline)), [baseline, profiles]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await client.wifiProfiles();
      const next = payload.profiles.map((profile) => ({ ...profile, password: "", clear_password: false }));
      setProfiles(next);
      setBaseline(next);
      setMaxProfiles(payload.max_profiles);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load Wi-Fi profiles");
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => { void load(); }, [load]);

  const update = (id: string, changes: Partial<WifiRecoveryProfileDraft>) => {
    setProfiles((current) => current.map((profile) => profile.id === id ? { ...profile, ...changes } : profile));
    setSuccess(null);
  };

  const add = () => {
    if (profiles.length >= maxProfiles) return;
    setProfiles((current) => [...current, { id: newId(), ssid: "", priority: 0, password_set: false, password: "", clear_password: false }]);
    setSuccess(null);
  };

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = await client.updateWifiProfiles(profiles);
      const next = payload.profiles.map((profile) => ({ ...profile, password: "", clear_password: false }));
      setProfiles(next);
      setBaseline(next);
      setMaxProfiles(payload.max_profiles);
      setSuccess("Fallback networks saved. Passwords remain write-only and will be used on the next recovery run or boot.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save Wi-Fi profiles");
    } finally {
      setSaving(false);
    }
  };

  return <section className="wifi-profile-editor">
    <header className="wifi-profile-heading">
      <div><span><Wifi size={17} />Preset networks</span><small>Highest priority visible network is tried first</small></div>
      <button className="icon-button" title="Reload profiles" disabled={loading || saving || dirty} onClick={() => void load()}><RefreshCw className={loading ? "spin" : ""} size={16} /></button>
    </header>
    {error && <p className="inline-error">{error}</p>}
    {success && <p className="inline-success">{success}</p>}
    <div className="wifi-profile-list">
      {profiles.map((profile, index) => <article className="wifi-profile-row" key={profile.id}>
        <span className="wifi-profile-number">{index + 1}</span>
        <label><span>SSID</span><input value={profile.ssid} maxLength={32} placeholder="Network name" disabled={saving} onChange={(event) => update(profile.id, { ssid: event.target.value })} /></label>
        <label><span>Password</span><div className="wifi-password-input"><KeyRound size={14} /><input type="password" value={profile.password ?? ""} placeholder={profile.clear_password ? "Will be cleared" : profile.password_set ? "Saved · enter to replace" : "Blank for open network"} disabled={saving || profile.clear_password} onChange={(event) => update(profile.id, { password: event.target.value, clear_password: false })} /></div></label>
        <label className="wifi-priority"><span>Priority</span><input type="number" min={-999} max={999} value={profile.priority} disabled={saving} onChange={(event) => update(profile.id, { priority: Number(event.target.value) })} /></label>
        <div className="wifi-row-actions">{profile.password_set && <button className={profile.clear_password ? "selected" : ""} title={profile.clear_password ? "Keep saved password" : "Clear saved password"} disabled={saving} onClick={() => update(profile.id, { clear_password: !profile.clear_password, password: "" })}><EyeOff size={15} /></button>}<button title="Remove profile" disabled={saving} onClick={() => setProfiles((current) => current.filter((item) => item.id !== profile.id))}><Trash2 size={15} /></button></div>
      </article>)}
      {!profiles.length && <p className="wifi-empty">No fallback networks configured. Add the networks EKO may use when its normal connection is unavailable.</p>}
    </div>
    <footer className="wifi-profile-footer"><span>{profiles.length}/{maxProfiles} networks</span><button className="secondary-button" disabled={saving || profiles.length >= maxProfiles} onClick={add}><Plus size={16} />Add network</button><button className="primary-button" disabled={!dirty || saving || profiles.some((profile) => !profile.ssid.trim())} onClick={() => void save()}><Save size={16} />{saving ? "Saving..." : "Save networks"}</button></footer>
  </section>;
}
