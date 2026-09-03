import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { MonitorDot, Play, Power, RefreshCw, ShieldCheck, TerminalSquare } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { EkoClient } from "../client";
import { EmptyState, Panel, SectionHeading } from "../components/Common";
import { websocketAuthProtocol, websocketUrl } from "../transports/websocketAuth";
import type { ConnectionProfile, LinkStats, TerminalStatus } from "../types";

function decodeBase64(value: string) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder().decode(bytes);
}

export function TerminalPage({ client, profile, stats }: { client: EkoClient | null; profile: ConnectionProfile; stats: LinkStats }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const disposeInputRef = useRef<(() => void) | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const [policy, setPolicy] = useState<TerminalStatus | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [surfaceActive, setSurfaceActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    const socket = socketRef.current; socketRef.current = null;
    if (socket) { socket.onopen = null; socket.onmessage = null; socket.onerror = null; socket.onclose = null; socket.close(); }
    disposeInputRef.current?.(); disposeInputRef.current = null;
    observerRef.current?.disconnect(); observerRef.current = null;
    terminalRef.current?.dispose(); terminalRef.current = null;
    if (containerRef.current) containerRef.current.replaceChildren();
    setSurfaceActive(false);
    setConnected(false); setConnecting(false);
  }, []);

  const refresh = useCallback(async () => {
    if (!client) { setPolicy(null); return; }
    try { setPolicy(await client.terminalStatus()); setError(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not read terminal policy"); }
  }, [client]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => () => close(), [close]);
  useEffect(() => { if (!stats.connected) close(); }, [close, stats.connected]);

  const connect = async () => {
    if (!client || !stats.connected) { setError("Connect to EKO first."); return; }
    if (profile.kind !== "wifi") { setError("The terminal requires EKO's HTTPS/WSS connection, not BLE."); return; }
    setConnecting(true); setError(null);
    try {
      const current = await client.terminalStatus();
      setPolicy(current);
      if (!current.enabled) throw new Error("Remote terminal is disabled. Enable terminal.enabled in Config, apply the batch, then return here.");
      close(); setConnecting(true);
      const terminal = new Terminal({
        cursorBlink: true,
        convertEol: true,
        fontFamily: "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace",
        fontSize: 13,
        scrollback: 4000,
        theme: { background: "#071018", foreground: "#d9e8f3", cursor: "#52e0c4", selectionBackground: "#2d678099", black: "#071018", brightBlack: "#536878", green: "#52e0c4", cyan: "#50aef8", red: "#ff6b72", yellow: "#f6c85f" },
      });
      const fit = new FitAddon();
      terminal.loadAddon(fit);
      if (!containerRef.current) throw new Error("Terminal surface is not ready");
      terminal.open(containerRef.current);
      setSurfaceActive(true);
      fit.fit(); terminal.focus();
      terminal.writeln("\x1b[36mOpening authenticated EKO PTY…\x1b[0m");
      terminalRef.current = terminal;
      const endpoint = websocketUrl(profile.wifiUrl, "/terminal/ws");
      const protocol = profile.wifiToken ? websocketAuthProtocol(profile.wifiToken) : undefined;
      const socket = protocol ? new WebSocket(endpoint, [protocol]) : new WebSocket(endpoint);
      socketRef.current = socket;
      socket.onopen = () => {
        setConnected(true); setConnecting(false);
        socket.send(JSON.stringify({ type: "terminal.resize", columns: terminal.cols, rows: terminal.rows }));
      };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as Record<string, unknown>;
          if (message.type === "terminal.output") terminal.write(decodeBase64(String(message.data_base64 ?? "")));
          else if (message.type === "terminal.ready") terminal.writeln(`\r\n\x1b[32mPTY ready · ${String(message.cwd ?? "EKO")}\x1b[0m\r\n`);
          else if (message.type === "terminal.exit") terminal.writeln(`\r\n\x1b[33mProcess exited (${String(message.code ?? "unknown")})\x1b[0m`);
          else if (message.type === "terminal.expired") terminal.writeln("\r\n\x1b[33mSession closed after the configured idle timeout.\x1b[0m");
          else if (message.type === "terminal.error") { const text = String(message.error ?? "Terminal protocol error"); setError(text); terminal.writeln(`\r\n\x1b[31m${text}\x1b[0m`); }
        } catch { terminal.writeln("\r\n\x1b[31mInvalid terminal message from EKO.\x1b[0m"); }
      };
      socket.onerror = () => setError("The PTY channel was rejected. Use the Tailscale HTTPS address, a valid API token, and an allowed GitHub Pages origin.");
      socket.onclose = () => { if (socketRef.current === socket) socketRef.current = null; setConnected(false); setConnecting(false); if (terminalRef.current === terminal) terminal.writeln("\r\n\x1b[90mPTY channel closed.\x1b[0m"); };
      const input = terminal.onData((data) => { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "terminal.input", data })); });
      const resize = terminal.onResize(({ cols, rows }) => { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "terminal.resize", columns: cols, rows })); });
      disposeInputRef.current = () => { input.dispose(); resize.dispose(); };
      const observer = new ResizeObserver(() => fit.fit());
      observer.observe(containerRef.current);
      observerRef.current = observer;
    } catch (cause) {
      close(); setError(cause instanceof Error ? cause.message : "Could not open the EKO terminal");
    } finally { setConnecting(false); }
  };

  return <div className="page-grid terminal-page"><Panel className="terminal-main"><SectionHeading kicker="TAILSCALE PTY" title="EKO terminal" action={<div className="terminal-actions"><button className="icon-button" onClick={() => void refresh()} title="Refresh terminal policy"><RefreshCw size={16} /></button>{connected ? <button className="secondary-button" onClick={close}><Power size={16} />Close</button> : <button className="primary-button" onClick={() => void connect()} disabled={!client || connecting}><Play size={16} />{connecting ? "Opening…" : "Open terminal"}</button>}</div>} /><div className={`terminal-surface ${connected ? "connected" : ""}`}><div className="terminal-host" ref={containerRef} />{!surfaceActive && <div className="terminal-empty"><EmptyState icon={TerminalSquare} title="PTY is closed" message="Open a new shell on the Raspberry Pi through the authenticated Tailscale channel." /></div>}</div>{error && <p className="inline-error">{error}</p>}</Panel><div className="terminal-side"><Panel><SectionHeading kicker="ACCESS POLICY" title="Security boundary" action={<ShieldCheck size={19} />} /><dl className="detail-list"><div><dt>Feature</dt><dd className={policy?.enabled ? "ready" : "disabled"}>{policy?.enabled ? "Enabled" : "Disabled"}</dd></div><div><dt>Sessions</dt><dd>{policy ? `${policy.active_sessions} / ${policy.max_sessions}` : "—"}</dd></div><div><dt>Idle timeout</dt><dd>{policy ? `${Math.round(policy.idle_timeout_seconds / 60)} min` : "—"}</dd></div><div><dt>Identity</dt><dd>{policy?.requires_tailscale_identity ? "Tailscale required" : "API token only"}</dd></div></dl></Panel><Panel className="terminal-explanation"><MonitorDot size={22} /><div><strong>Why this is not an HDMI mirror</strong><p>Raspberry Pi OS Lite has no dependable browser-safe copy of the physical <code>/dev/tty1</code> framebuffer. This page opens a fresh PTY as the EKO service user, which gives reliable terminal control without scraping the monitor or granting root access.</p></div></Panel></div></div>;
}
