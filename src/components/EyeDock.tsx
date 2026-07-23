import { Eye, ScanFace } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { eyeLayout } from "../eyeDisplay";
import type { EyeState, StatusPayload } from "../types";

const offlineEye: EyeState = {
  expression: "sleeping", gaze_x: 0, gaze_y: 0, blink: true,
  source: "offline", updated_at: 0, revision: 0,
};

function EyeScreen({ side, state, localBlink }: { side: "left" | "right"; state: EyeState; localBlink: boolean }) {
  const active = { ...state, blink: state.blink || localBlink };
  const layout = eyeLayout(active);
  const expression = active.expression;
  const brow = expression === "determined" || expression === "angry"
    ? side === "left" ? "M 5 5 L 122 21" : "M 5 21 L 122 5"
    : expression === "thinking"
      ? side === "left" ? "M 8 12 L 117 5" : "M 11 5 L 120 12"
      : null;
  return <div className="eko-eye-screen" aria-label={`${side} EKO eye, ${expression}`}>
    <svg viewBox="0 0 128 64" role="img">
      <rect width="128" height="64" rx="3" fill="#01080c" />
      {layout.blink ? <path d="M 18 33 L 110 33" stroke="#bafcff" strokeWidth="4" strokeLinecap="round" /> : <>
        <ellipse cx="64" cy="32" rx={layout.eyeRx} ry={layout.eyeRy} fill="#bafcff" />
        <ellipse cx={layout.pupilX} cy={layout.pupilY} rx={layout.pupilRx} ry={layout.pupilRy} fill="#04141b" />
        <ellipse cx={layout.pupilX - 3} cy={layout.pupilY - 5} rx="3" ry="4" fill="#eaffff" />
        {expression === "happy" && <rect x="0" y="0" width="128" height="25" fill="#01080c" />}
        {expression === "error" && <><path d="M 22 12 L 105 52" stroke="#01080c" strokeWidth="8" /><path d="M 105 12 L 22 52" stroke="#01080c" strokeWidth="8" /></>}
        {brow && <path d={brow} stroke="#01080c" strokeWidth="9" strokeLinecap="round" />}
      </>}
    </svg>
    <span>{side.toUpperCase()} · 128×64</span>
  </div>;
}

export function EyeDock({ status }: { status: StatusPayload | null }) {
  const [localBlink, setLocalBlink] = useState(false);
  const state = status?.capability_status?.eyes?.state ?? offlineEye;
  useEffect(() => {
    if (!status) return undefined;
    let closeTimer: number | undefined;
    const interval = window.setInterval(() => {
      setLocalBlink(true);
      closeTimer = window.setTimeout(() => setLocalBlink(false), 135);
    }, 4200);
    return () => {
      window.clearInterval(interval);
      if (closeTimer !== undefined) window.clearTimeout(closeTimer);
    };
  }, [status]);
  const eyeStatus = status?.capability_status?.eyes;
  const activeFace = status?.capability_status?.faces?.active;
  const direction = status?.capability_status?.sound_direction?.last_estimate;
  const source = useMemo(() => state.source.replaceAll("_", " "), [state.source]);
  return <aside className="eye-dock">
    <header><div><span className="eyebrow">EKO FACE BUS</span><strong>Live eyes</strong></div><Eye size={18} /></header>
    <div className="eye-pair"><EyeScreen side="left" state={state} localBlink={localBlink} /><EyeScreen side="right" state={state} localBlink={localBlink} /></div>
    <dl className="eye-telemetry">
      <div><dt>Expression</dt><dd>{state.expression}</dd></div>
      <div><dt>Source</dt><dd>{source}</dd></div>
      <div><dt>OLED link</dt><dd className={eyeStatus?.connected ? "ready" : "disabled"}>{eyeStatus?.connected ? "Synchronized" : eyeStatus?.enabled ? "Waiting" : "Preview only"}</dd></div>
      <div><dt>Seen face</dt><dd>{activeFace ? <span><ScanFace size={12} />{activeFace.name}</span> : "None"}</dd></div>
      <div><dt>Sound angle</dt><dd>{direction ? `${direction.angle_degrees.toFixed(0)}° ${direction.side}` : "—"}</dd></div>
    </dl>
    <p>Both previews consume the same expression and gaze state sent to the two physical 128×64 displays.</p>
  </aside>;
}
