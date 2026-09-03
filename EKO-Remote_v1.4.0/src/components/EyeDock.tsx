import { Eye, ScanFace } from "lucide-react";
import { useMemo } from "react";
import { eyeLayout } from "../eyeDisplay";
import type { EyeState, StatusPayload } from "../types";

const offlineEye: EyeState = {
  expression: "sleeping", gaze_x: 0, gaze_y: 0, blink: true,
  source: "offline", updated_at: 0, revision: 0,
};

function FocusCorners({ inset = 5 }: { inset?: number }) {
  const far = 128 - inset;
  return <path
    d={`M${inset} 15V${inset}H${inset + 13} M${far - 13} ${inset}H${far}V15 M${inset} 49V${64 - inset}H${inset + 13} M${far - 13} ${64 - inset}H${far}V49`}
    fill="none" stroke="#bafcff" strokeWidth="2" strokeLinecap="round"
  />;
}

function EyeAdornment({ kind, side, pupilX, pupilY }: {
  kind: ReturnType<typeof eyeLayout>["adornment"];
  side: "left" | "right";
  pupilX: number;
  pupilY: number;
}) {
  if (kind === "listening") return <g stroke="#bafcff" strokeWidth="2" strokeLinecap="round">
    <path d="M18 25V39 M11 20V44 M110 25V39 M117 20V44" />
  </g>;
  if (kind === "thinking") {
    const xs = side === "left" ? [106, 98, 90] : [22, 30, 38];
    return <g fill="#bafcff">{xs.map((x, index) => <circle key={x} cx={x} cy="12" r={index + 2} />)}</g>;
  }
  if (kind === "speaking") return <g stroke="#bafcff" strokeWidth="2" strokeLinecap="round">
    <path d="M13 24H25 M8 32H27 M13 40H25 M103 24H115 M101 32H120 M103 40H115" />
  </g>;
  if (kind === "focus") return <FocusCorners />;
  if (kind === "camera") return <g><FocusCorners inset={2} /><path d="M64 0V8 M64 56V64 M25 32H34 M94 32H103" stroke="#bafcff" /></g>;
  if (kind === "happy") return <g stroke="#bafcff" strokeWidth="2" strokeLinecap="round">
    <path d="M12 13H24 M18 7V19 M104 50H112 M108 46V54" />
  </g>;
  if (kind === "surprised") return <path d="M64 0V5 M64 59V64 M25 32H31 M97 32H103 M34 5L39 10 M89 54L94 59 M34 59L39 54 M89 10L94 5" stroke="#bafcff" strokeWidth="2" />;
  if (kind === "error") return <g stroke="#bafcff" strokeWidth="2" strokeLinecap="round">
    <path d="M15 12L25 22 M25 12L15 22" />
    <path d={`M${pupilX} ${pupilY - 7}V${pupilY + 2}`} strokeWidth="3" />
    <circle cx={pupilX} cy={pupilY + 8} r="2" fill="#bafcff" stroke="none" />
  </g>;
  if (kind === "angry") return <path d="M14 18L22 23 M12 27L21 29 M114 18L106 23 M116 27L107 29" stroke="#bafcff" strokeWidth="2" />;
  if (kind === "alert") return <path d="M64 1V9 M22 8L29 15 M106 8L99 15 M17 49L27 44 M111 49L101 44" stroke="#bafcff" strokeWidth="2.5" />;
  return null;
}

function EyeScreen({ side, state }: { side: "left" | "right"; state: EyeState }) {
  const layout = eyeLayout(state, side);
  const expression = state.expression;
  return <div className="eko-eye-screen" aria-label={`${side} EKO eye, ${expression}`}>
    <svg viewBox="0 0 128 64" role="img">
      <rect width="128" height="64" rx="3" fill="#01080c" />
      {layout.blink ? <>
        <path d="M37 34H91" stroke="#bafcff" strokeWidth="4" strokeLinecap="round" />
        {layout.adornment === "sleeping" && <path d="M96 18H111L96 29H111" stroke="#bafcff" strokeWidth="2" fill="none" />}
      </> : <>
        <ellipse cx="64" cy="32" rx={layout.eyeRadius} ry={layout.eyeYRadius} fill="#bafcff" />
        <circle cx={layout.pupilX} cy={layout.pupilY} r={layout.pupilRadius} fill="#04141b" />
        <circle cx={layout.pupilX - 3} cy={layout.pupilY - 4} r="2.2" fill="#eaffff" />
        <EyeAdornment kind={layout.adornment} side={side} pupilX={layout.pupilX} pupilY={layout.pupilY} />
      </>}
    </svg>
    <span>{side.toUpperCase()} · 128×64</span>
  </div>;
}

export function EyeDock({ status }: { status: StatusPayload | null }) {
  const state = status?.capability_status?.eyes?.state ?? offlineEye;
  const eyeStatus = status?.capability_status?.eyes;
  const activeFace = status?.capability_status?.faces?.active;
  const direction = status?.capability_status?.sound_direction?.last_estimate;
  const source = useMemo(() => state.source.replaceAll("_", " "), [state.source]);
  return <aside className="eye-dock">
    <header><div><span className="eyebrow">EKO FACE BUS</span><strong>Live eyes</strong></div><Eye size={18} /></header>
    <div className="eye-pair"><EyeScreen side="left" state={state} /><EyeScreen side="right" state={state} /></div>
    <dl className="eye-telemetry">
      <div><dt>Expression</dt><dd>{state.expression}</dd></div>
      <div><dt>Source</dt><dd>{source}</dd></div>
      <div><dt>OLED link</dt><dd className={eyeStatus?.connected ? "ready" : "disabled"}>{eyeStatus?.connected ? "Synchronized" : eyeStatus?.enabled ? "Waiting" : "Preview only"}</dd></div>
      <div><dt>Seen face</dt><dd>{activeFace ? <span><ScanFace size={12} />{activeFace.name}</span> : "None"}</dd></div>
      <div><dt>Sound angle</dt><dd>{direction ? `${direction.angle_degrees.toFixed(0)}° ${direction.side}` : "—"}</dd></div>
    </dl>
    <p>Both previews use the last frame committed to both physical displays.</p>
  </aside>;
}
