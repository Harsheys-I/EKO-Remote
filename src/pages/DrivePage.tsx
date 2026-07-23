import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bluetooth, CircleStop, Gamepad2, History, Radar, RotateCcw, RotateCw, ShieldAlert, Wifi } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { EkoClient } from "../client";
import { EmptyState, Panel, SectionHeading } from "../components/Common";
import { gamepadVectorSignature, readGamepadVector } from "../gamepad";
import type { ControlStatus, DriveVector, LinkStats, RobotState, RuntimeSettings } from "../types";

const keyVectors: Record<string, DriveVector> = { w: { vx: 0, vy: 1, wz: 0 }, ArrowUp: { vx: 0, vy: 1, wz: 0 }, s: { vx: 0, vy: -1, wz: 0 }, ArrowDown: { vx: 0, vy: -1, wz: 0 }, a: { vx: -1, vy: 0, wz: 0 }, ArrowLeft: { vx: -1, vy: 0, wz: 0 }, d: { vx: 1, vy: 0, wz: 0 }, ArrowRight: { vx: 1, vy: 0, wz: 0 }, q: { vx: 0, vy: 0, wz: -1 }, e: { vx: 0, vy: 0, wz: 1 } };
const controlKeys = [{ key: "w", label: "W", icon: ArrowUp, alternate: "ArrowUp" }, { key: "q", label: "Q", icon: RotateCcw }, { key: "e", label: "E", icon: RotateCw }, { key: "a", label: "A", icon: ArrowLeft, alternate: "ArrowLeft" }, { key: "s", label: "S", icon: ArrowDown, alternate: "ArrowDown" }, { key: "d", label: "D", icon: ArrowRight, alternate: "ArrowRight" }];

function RobotSimulator({ motion }: { motion: DriveVector }) {
  const [pose, setPose] = useState({ x: 50, y: 50, angle: 0, trail: [] as Array<{ x: number; y: number }> });
  const motionRef = useRef(motion);
  const lastRef = useRef(performance.now());
  const trailRef = useRef(0);
  useEffect(() => { motionRef.current = motion; }, [motion]);
  useEffect(() => {
    let frame = 0;
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - lastRef.current) / 1000);
      lastRef.current = now;
      const value = motionRef.current;
      const vx = value.vx;
      const vy = value.vy;
      const wz = value.wz;
      setPose((current) => {
        const radians = current.angle * Math.PI / 180;
        const scale = 24;
        const x = Math.max(5, Math.min(95, current.x + (vx * Math.cos(radians) + vy * Math.sin(radians)) * scale * dt));
        const y = Math.max(7, Math.min(93, current.y + (vx * Math.sin(radians) - vy * Math.cos(radians)) * scale * dt));
        const angle = (current.angle + wz * 120 * dt + 360) % 360;
        let trail = current.trail;
        if (now - trailRef.current > 120 && Math.max(Math.abs(vx), Math.abs(vy), Math.abs(wz)) > 0.02) {
          trailRef.current = now;
          trail = [...trail.slice(-34), { x, y }];
        }
        return { x, y, angle, trail };
      });
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);
  const rawWheels: Record<string, number> = {
    front_left: motion.vy + motion.vx - motion.wz,
    front_right: motion.vy - motion.vx + motion.wz,
    rear_left: motion.vy - motion.vx - motion.wz,
    rear_right: motion.vy + motion.vx + motion.wz,
  };
  const scale = Math.max(1, ...Object.values(rawWheels).map(Math.abs));
  const wheels = Object.fromEntries(Object.entries(rawWheels).map(([name, value]) => [name, value / scale]));
  return <div className="robot-simulator"><header><span><Radar size={16} />Controller vector preview</span><button className="text-button" onClick={() => setPose({ x: 50, y: 50, angle: 0, trail: [] })}>Recenter</button></header><div className="sim-field"><span className="sim-grid" />{pose.trail.map((point, index) => <i className="trail-dot" key={index} style={{ left: `${point.x}%`, top: `${point.y}%`, opacity: (index + 4) / (pose.trail.length + 4) }} />)}<div className="sim-robot" style={{ left: `${pose.x}%`, top: `${pose.y}%`, transform: `translate(-50%, -50%) rotate(${pose.angle}deg)` }}><i className="heading" /><span className="wheel fl" /><span className="wheel fr" /><span className="wheel rl" /><span className="wheel rr" /><strong>EKO</strong></div></div><div className="wheel-readout">{["front_left", "front_right", "rear_left", "rear_right"].map((name) => <span key={name}><small>{name.replace("front_", "F").replace("rear_", "R").replace("left", "L").replace("right", "R")}</small><i><b style={{ width: `${Math.abs(Number(wheels[name] ?? 0)) * 100}%` }} /></i><strong>{Number(wheels[name] ?? 0).toFixed(2)}</strong></span>)}</div></div>;
}

export function DrivePage({ client, state, settings, stats, onSettings }: { client: EkoClient | null; state: RobotState; settings: RuntimeSettings | null; stats: LinkStats; onSettings: (settings: RuntimeSettings) => void }) {
  const [pressed, setPressed] = useState<Set<string>>(new Set());
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const [control, setControl] = useState<ControlStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gamepadName, setGamepadName] = useState<string | null>(null);
  const [gamepadVector, setGamepadVector] = useState<DriveVector>({ vx: 0, vy: 0, wz: 0 });
  const pointerActive = useRef(false);
  const hardwareReady = Boolean(client && settings?.control_mode !== "stationary" && stats.connected && settings?.hardware_enabled && settings?.motors_enabled);
  const vector = useMemo(() => { const value = { vx: stick.x + gamepadVector.vx, vy: -stick.y + gamepadVector.vy, wz: gamepadVector.wz }; pressed.forEach((key) => { const next = keyVectors[key]; if (next) { value.vx += next.vx; value.vy += next.vy; value.wz += next.wz; } }); return { vx: Math.max(-1, Math.min(1, value.vx)), vy: Math.max(-1, Math.min(1, value.vy)), wz: Math.max(-1, Math.min(1, value.wz)) }; }, [gamepadVector, pressed, stick]);
  const sendVector = useCallback(async (next: DriveVector) => { if (!client) return; try { await client.drive(next); setError(null); } catch (cause) { setError(cause instanceof Error ? cause.message : "Drive command failed"); } }, [client]);

  useEffect(() => { const down = (event: KeyboardEvent) => { if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return; if (keyVectors[event.key]) { event.preventDefault(); setPressed((keys) => new Set(keys).add(event.key)); } }; const up = (event: KeyboardEvent) => { if (keyVectors[event.key]) setPressed((keys) => { const next = new Set(keys); next.delete(event.key); return next; }); }; window.addEventListener("keydown", down); window.addEventListener("keyup", up); return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); }; }, []);
  useEffect(() => { const releaseAll = () => { setPressed(new Set()); setStick({ x: 0, y: 0 }); if (document.visibilityState === "hidden") void client?.stop().catch(() => undefined); }; window.addEventListener("blur", releaseAll); document.addEventListener("visibilitychange", releaseAll); return () => { window.removeEventListener("blur", releaseAll); document.removeEventListener("visibilitychange", releaseAll); }; }, [client]);
  useEffect(() => () => { void client?.stop().catch(() => undefined); }, [client]);
  useEffect(() => { if (!hardwareReady) return; const active = Math.max(Math.abs(vector.vx), Math.abs(vector.vy), Math.abs(vector.wz)) > .02; if (!active) { void sendVector({ vx: 0, vy: 0, wz: 0 }); return; } void sendVector(vector); const interval = window.setInterval(() => void sendVector(vector), stats.kind === "ble" ? 320 : 250); return () => window.clearInterval(interval); }, [hardwareReady, sendVector, stats.kind, vector]);
  useEffect(() => { if (!client) return; const load = async () => { try { setControl(await client.control()); } catch { /* telemetry may still work */ } }; void load(); const interval = window.setInterval(load, 3000); return () => window.clearInterval(interval); }, [client]);
  useEffect(() => {
    if (!("getGamepads" in navigator)) return;
    let frame = 0;
    let last = "";
    let selectedIndex: number | null = null;
    const zero = { vx: 0, vy: 0, wz: 0 };
    const poll = () => {
      const gamepads = [...navigator.getGamepads()];
      const selected = selectedIndex === null ? null : gamepads[selectedIndex];
      const gamepad = selected ?? gamepads.find((value): value is Gamepad => Boolean(value?.connected));
      if (gamepad) {
        selectedIndex = gamepad.index;
        setGamepadName(gamepad.id);
        const next = readGamepadVector(gamepad);
        const signature = gamepadVectorSignature(next);
        if (signature !== last) { last = signature; setGamepadVector(next); }
      } else {
        selectedIndex = null;
        setGamepadName(null);
        const signature = gamepadVectorSignature(zero);
        if (last !== signature) { last = signature; setGamepadVector(zero); }
      }
      frame = requestAnimationFrame(poll);
    };
    const connected = (event: GamepadEvent) => { selectedIndex = event.gamepad.index; setGamepadName(event.gamepad.id); };
    const disconnected = (event: GamepadEvent) => { if (selectedIndex === event.gamepad.index) selectedIndex = null; };
    window.addEventListener("gamepadconnected", connected);
    window.addEventListener("gamepaddisconnected", disconnected);
    frame = requestAnimationFrame(poll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("gamepadconnected", connected);
      window.removeEventListener("gamepaddisconnected", disconnected);
    };
  }, []);

  const update = async (changes: Partial<RuntimeSettings>) => { if (!client) return; try { onSettings(await client.updateSettings(changes)); setError(null); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update drive profile"); } };
  const stop = async () => { setPressed(new Set()); setStick({ x: 0, y: 0 }); if (!client) return; try { await client.stop(); setError(null); } catch (cause) { setError(cause instanceof Error ? cause.message : "Stop request failed"); } };
  const pressKey = (key: string) => setPressed((keys) => new Set(keys).add(key));
  const releaseKey = (key: string) => setPressed((keys) => { const next = new Set(keys); next.delete(key); return next; });
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => { if (!pointerActive.current) return; const box = event.currentTarget.getBoundingClientRect(); const x = (event.clientX - box.left - box.width / 2) / (box.width / 2); const y = (event.clientY - box.top - box.height / 2) / (box.height / 2); const length = Math.max(1, Math.hypot(x, y)); setStick({ x: x / length, y: y / length }); };
  const releasePointer = () => { pointerActive.current = false; setStick({ x: 0, y: 0 }); };

  return <div className="page-grid drive-page">{!hardwareReady && <div className="safety-banner"><ShieldAlert size={20} /><div><strong>Movement controls are locked</strong><span>{!stats.connected ? "Connect to EKO before driving." : settings?.control_mode === "stationary" ? "Stationary mode is active. Select manual or assist to move." : !settings?.hardware_enabled ? "Physical hardware is disabled in Config." : !settings?.motors_enabled ? "Motor drivers are intentionally disabled until both TB6612FNG boards and all four motors are installed." : "The physical motor service is not ready."}</span></div></div>}
    <Panel className="drive-panel"><SectionHeading kicker="LIVE CONTROLLER" title="Holonomic drive" action={<span className={`motion-badge ${state.moving ? "moving" : ""}`}><i />{state.moving ? "Moving" : "Stopped"}</span>} /><div className="drive-workspace"><div className="joystick" onPointerDown={(event) => { pointerActive.current = true; event.currentTarget.setPointerCapture(event.pointerId); pointerMove(event); }} onPointerMove={pointerMove} onPointerUp={releasePointer} onPointerCancel={releasePointer}><span className="axis horizontal" /><span className="axis vertical" /><div className="joystick-knob" style={{ transform: `translate(calc(-50% + ${stick.x * 72}px), calc(-50% + ${stick.y * 72}px))` }}><Gamepad2 size={22} /></div></div><div className="keypad">{controlKeys.map(({ key, label, icon: Icon, alternate }) => <button type="button" key={key} className={pressed.has(key) || Boolean(alternate && pressed.has(alternate)) ? "active" : ""} onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); pressKey(key); }} onPointerUp={() => releaseKey(key)} onPointerCancel={() => releaseKey(key)} onContextMenu={(event) => event.preventDefault()}><Icon /><kbd>{label}</kbd></button>)}</div></div><div className="vector-readout"><span>VX <strong>{vector.vx.toFixed(2)}</strong></span><span>VY <strong>{vector.vy.toFixed(2)}</strong></span><span>WZ <strong>{vector.wz.toFixed(2)}</strong></span></div>{error && <p className="inline-error">{error}</p>}</Panel>
    <Panel className="drive-profile"><SectionHeading kicker="DRIVE PROFILE" title="Mode & limits" action={stats.kind === "ble" ? <Bluetooth size={18} /> : <Wifi size={18} />} /><div className="mode-selector">{(["manual", "assist", "stationary"] as const).map((mode) => <button key={mode} className={settings?.control_mode === mode ? "selected" : ""} onClick={() => void update({ control_mode: mode })}><strong>{mode}</strong><span>{mode === "manual" ? "Direct operator input" : mode === "assist" ? "Reduced response" : "Lock all motion"}</span></button>)}</div><label className="range-control"><div><span>Robot speed limit</span><strong>{Math.round((settings?.speed_limit ?? .45) * 100)}%</strong></div><input type="range" min="5" max="100" value={(settings?.speed_limit ?? .45) * 100} onChange={(event) => settings && onSettings({ ...settings, speed_limit: Number(event.target.value) / 100 })} onPointerUp={(event) => void update({ speed_limit: Number(event.currentTarget.value) / 100 })} onKeyUp={(event) => void update({ speed_limit: Number(event.currentTarget.value) / 100 })} /></label><div className={`gamepad-status ${gamepadName ? "connected" : ""}`}><Gamepad2 size={18} /><span><strong>{gamepadName ? "Gamepad connected" : "Gamepad auto-detect"}</strong><small>{!("getGamepads" in navigator) ? "This browser does not support gamepads" : gamepadName ?? "Press any controller button — no software pairing step"}</small></span><i /></div><p className="gamepad-map">Left stick: strafe / drive · L1/R1: rotate</p><button className="emergency-button" onClick={() => void stop()} disabled={!stats.connected}><CircleStop size={20} />Emergency stop</button><p className="watchdog-note">Commands repeat while input is held. If Wi-Fi, BLE, this tab, or the controller fails, EKO's 750 ms robot-side watchdog stops the motors.</p></Panel>
    <Panel className="simulator-panel"><SectionHeading kicker="KINEMATICS" title="Top-down drivetrain preview" action={<Gamepad2 size={18} />} /><RobotSimulator motion={vector} /></Panel>
    <Panel className="command-history"><SectionHeading kicker="ROBOT ACKNOWLEDGEMENTS" title="Recent motion" action={<History size={18} />} />{control?.recent_commands.length ? <div className="command-list">{control.recent_commands.slice(0, 12).map((command, index) => <article key={`${command.monotonic_time}-${index}`}><span>{command.command}</span><code>{JSON.stringify(command.payload)}</code></article>)}</div> : <EmptyState icon={History} title="No drive history" message="Accepted motion commands will appear here." />}</Panel>
  </div>;
}
