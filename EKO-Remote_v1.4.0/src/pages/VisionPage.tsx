import { Aperture, Bluetooth, Camera, Clock3, ImageOff, RefreshCw, ScanFace, ShieldCheck, Trash2, UserPlus, UserRoundSearch, Wifi } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { EkoClient } from "../client";
import { EmptyState, Panel, SectionHeading, Toggle } from "../components/Common";
import type { FaceRecord, FacesPayload, LinkStats, RuntimeSettings, StatusPayload, VisionSnapshot } from "../types";

export function VisionPage({ client, status, stats, onSettings }: { client: EkoClient | null; status: StatusPayload | null; stats: LinkStats; onSettings: (settings: RuntimeSettings) => void }) {
  const [snapshot, setSnapshot] = useState<VisionSnapshot | null>(null);
  const [faces, setFaces] = useState<FacesPayload | null>(null);
  const [name, setName] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settings = status?.settings;
  const faceStatus = status?.capability_status?.faces;
  const follow = status?.capability_status?.person_follow;
  const runtime = status?.capability_status?.vision_runtime;
  const ready = Boolean(client && settings?.vision_enabled && settings?.camera_on_demand);

  const refreshFaces = useCallback(async () => {
    if (!client) return;
    try { setFaces(await client.faces()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load enrolled faces"); }
  }, [client]);
  useEffect(() => { if (stats.connected) void refreshFaces(); }, [refreshFaces, stats.connected, faceStatus?.enrolled, faceStatus?.active?.face_id]);

  const capture = async () => {
    if (!client) return;
    setCapturing(true); setError(null);
    try {
      setSnapshot(await client.snapshot());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Camera capture failed");
    } finally {
      setCapturing(false);
    }
  };
  const setPolicy = async (camera_on_demand: boolean) => {
    if (!client) return;
    try { onSettings(await client.updateSettings({ camera_on_demand })); setError(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update camera policy"); }
  };
  const enroll = async () => {
    if (!client || !name.trim()) return;
    setEnrolling(true); setError(null);
    try { await client.enrollFace(name.trim()); setName(""); await refreshFaces(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Face enrollment failed"); }
    finally { setEnrolling(false); }
  };
  const removeFace = async (face: FaceRecord) => {
    if (!client || !window.confirm(`Delete the local face ID and label for ${face.name}? Their face-scoped memories are not deleted.`)) return;
    try { await client.deleteFace(face.face_id); await refreshFaces(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete the face ID"); }
  };
  const toggleFollow = async () => {
    if (!client) return;
    setFollowBusy(true); setError(null);
    try { if (follow?.active) await client.stopFollowing(); else await client.startFollowing(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not change following mode"); }
    finally { setFollowBusy(false); }
  };

  return <div className="page-grid vision-page vision-page-v5">
    <Panel className="camera-panel"><SectionHeading kicker="ON-DEMAND CAMERA" title="Latest frame" action={<button className="primary-button" onClick={() => void capture()} disabled={!ready || capturing}>{capturing ? <RefreshCw className="spin" size={17} /> : <Camera size={17} />}{capturing ? "Receiving…" : "Capture frame"}</button>} />
      {stats.kind === "ble" && <div className="transport-warning"><Bluetooth size={18} /><p>BLE snapshot transfer is chunked but slower. Wi-Fi is recommended for camera images.</p></div>}
      <div className="camera-viewport">{snapshot ? <><img src={`data:${snapshot.mime_type};base64,${snapshot.image_base64}`} alt="Latest frame from EKO" /><div className="frame-overlay"><span>CAM 01</span><time><Clock3 size={13} />{new Date(snapshot.captured_at * 1000).toLocaleString()}</time></div></> : <EmptyState icon={ImageOff} title="No captured frame" message="Request one frame for the Remote. Local OpenCV perception remains separate and never uploads frames unless you ask EKO to look." />}</div>
      {error && <p className="inline-error">{error}</p>}
    </Panel>
    <div className="vision-sidebar">
      <Panel><SectionHeading kicker="CAMERA POLICY" title="Access" action={<ShieldCheck size={19} />} /><Toggle checked={Boolean(settings?.camera_on_demand)} label="On-demand AI/snapshot" description="Permit explicit image requests" disabled={!client || !settings?.vision_enabled} onChange={(value) => void setPolicy(value)} /><div className="privacy-note"><Camera size={18} /><p>OpenCV perception stays on the Raspberry Pi for faces, eye gaze, and following. Only explicit CAMERA questions send a frame to Groq.</p></div></Panel>
      <Panel><SectionHeading kicker="PERCEPTION" title="Runtime" action={<Aperture size={19} />} /><dl className="detail-list"><div><dt>Adapter</dt><dd className={ready ? "ready" : "disabled"}>{settings?.vision_enabled ? "Pi camera" : "Disabled"}</dd></div><div><dt>OpenCV loop</dt><dd>{runtime?.running ? `${runtime.frame_sequence} frames` : "Stopped"}</dd></div><div><dt>Face IDs</dt><dd>{faceStatus?.enabled ? `${faceStatus.enrolled} enrolled` : "Disabled"}</dd></div><div><dt>Link</dt><dd>{stats.kind === "ble" ? <span><Bluetooth size={12} /> BLE</span> : <span><Wifi size={12} /> Wi-Fi</span>}</dd></div></dl></Panel>
    </div>
    <Panel className="face-panel"><SectionHeading kicker="LOCAL IDENTITY" title="Faces and memories" action={<ScanFace size={20} />} />
      <div className="face-enroll"><input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Person's name" aria-label="Name for face enrollment" /><button className="primary-button" onClick={() => void enroll()} disabled={!client || !faceStatus?.enabled || !name.trim() || enrolling}><UserPlus size={16} />{enrolling ? "Collecting samples…" : "Enroll face"}</button></div>
      <p className="face-help">Enrollment collects several local frames. Recognized microphone conversations use <code>face-&lt;id&gt;</code> as the existing memory user ID. This convenience recognition is not authentication.</p>
      {faces?.active && <div className="active-face"><UserRoundSearch size={17} /><span><strong>{faces.active.name}</strong> currently recognized</span><code>{Math.round(faces.active.confidence * 100)}%</code></div>}
      <div className="face-list">{faces?.faces.length ? faces.faces.map((face) => <article key={face.face_id}><ScanFace size={18} /><div><strong>{face.name}</strong><span>{face.sample_count} samples · {face.user_id}</span></div><button className="icon-button" onClick={() => void removeFace(face)} title={`Delete ${face.name}`}><Trash2 size={15} /></button></article>) : <p className="muted-copy">{faceStatus?.enabled ? "No faces enrolled yet." : "Enable vision.faces.enabled in Config, then restart EKO."}</p>}</div>
    </Panel>
    <Panel className="follow-panel"><SectionHeading kicker="LOWER-BODY TRACKING" title="Follow a person" action={<UserRoundSearch size={20} />} /><div className={`follow-status ${follow?.active ? "active" : ""}`}><i /><div><strong>{follow?.active ? "Following live" : follow?.available ? "Ready but stopped" : follow?.enabled ? "Waiting for motor drivers" : "Disabled in Config"}</strong><span>{follow?.active ? "The planner stops on target loss, Nano hazard, watchdog, or the time limit." : follow?.enabled && !follow?.available ? "OpenCV tracking is installed, but physical following remains locked until the motor drivers are installed and enabled." : "OpenCV selects the largest lower-body target; EKO does not identify who it follows."}</span></div></div><button className={follow?.active ? "stop-button follow-button" : "primary-button follow-button"} onClick={() => void toggleFollow()} disabled={!client || !follow?.available || followBusy}>{followBusy ? "Changing…" : follow?.active ? "Stop following" : "Start following"}</button>{follow?.last_error && <p className="inline-error">{follow.last_error}</p>}</Panel>
  </div>;
}
