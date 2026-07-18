import { useCallback, useEffect, useRef, useState } from "react";
import { EkoClient } from "../client";
import { BleTransport } from "../transports/BleTransport";
import type { EkoTransport } from "../transports/Transport";
import { WifiTransport } from "../transports/WifiTransport";
import type { ConnectionProfile, EkoEvent, LinkStats, RuntimeSettings, StatusPayload, TelemetryMessage } from "../types";

const PROFILE_KEY = "eko-remote-connection-v1";
const defaultProfile: ConnectionProfile = {
  kind: "wifi",
  wifiUrl: import.meta.env.VITE_EKO_API_URL?.trim() || "http://127.0.0.1:8765",
  wifiToken: "",
  bleToken: "",
  bleDeviceId: "",
  autoReconnect: true,
};

function readProfile(): ConnectionProfile {
  try { return { ...defaultProfile, ...JSON.parse(window.localStorage.getItem(PROFILE_KEY) || "{}") as Partial<ConnectionProfile> }; }
  catch { return defaultProfile; }
}

const eventKey = (event: EkoEvent) => `${event.timestamp}:${event.name}:${event.correlation_id ?? ""}`;

export function useEkoConnection() {
  const [profile, setProfile] = useState<ConnectionProfile>(readProfile);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [events, setEvents] = useState<EkoEvent[]>([]);
  const [client, setClient] = useState<EkoClient | null>(null);
  const [stats, setStats] = useState<LinkStats>({ connected: false, connecting: false, kind: null, label: "No link", latencyMs: null, lastUpdated: null, error: null });
  const transportRef = useRef<EkoTransport | null>(null);
  const autoAttempted = useRef(false);
  const pollFailures = useRef(0);

  const mergeEvents = useCallback((incoming: EkoEvent[]) => {
    setEvents((current) => {
      const seen = new Set<string>();
      return [...incoming, ...current].filter((event) => { const key = eventKey(event); if (seen.has(key)) return false; seen.add(key); return true; }).sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 300);
    });
  }, []);

  const receiveTelemetry = useCallback((message: TelemetryMessage) => {
    setStatus(message.status); mergeEvents(message.events);
    setStats((current) => ({ ...current, connected: true, connecting: false, latencyMs: Math.max(0, Math.round(Date.now() - message.sent_at * 1000)), lastUpdated: new Date(), error: null }));
  }, [mergeEvents]);

  const disconnect = useCallback(async (stopFirst = true) => {
    const transport = transportRef.current;
    if (transport) {
      if (stopFirst) { try { await transport.emergencyStop(); } catch { /* dead-man watchdog remains authoritative */ } }
      await transport.disconnect();
    }
    transportRef.current = null; setClient(null); setStatus(null);
    setStats({ connected: false, connecting: false, kind: null, label: "No link", latencyMs: null, lastUpdated: null, error: null });
  }, []);

  const connect = useCallback(async (nextProfile: ConnectionProfile) => {
    if (transportRef.current) await disconnect(false);
    setStats({ connected: false, connecting: true, kind: nextProfile.kind, label: nextProfile.kind === "wifi" ? "Wi-Fi" : "Bluetooth", latencyMs: null, lastUpdated: null, error: null });
    let transport: EkoTransport | null = null;
    const started = performance.now();
    try {
      transport = nextProfile.kind === "wifi"
        ? new WifiTransport(nextProfile.wifiUrl, nextProfile.wifiToken)
        : new BleTransport(nextProfile.bleDeviceId, nextProfile.bleToken);
      transportRef.current = transport;
      transport.subscribe(receiveTelemetry);
      transport.onDisconnect((reason) => {
        if (transportRef.current === transport) transportRef.current = null;
        setClient(null); setStatus(null);
        setStats((current) => ({ ...current, connected: false, connecting: false, error: reason || "Connection lost" }));
      });
      await transport.connect();
      const actualProfile = transport instanceof BleTransport ? { ...nextProfile, bleDeviceId: transport.deviceId } : nextProfile;
      const persisted = actualProfile.autoReconnect ? actualProfile : { ...actualProfile, wifiToken: "", bleToken: "" };
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(persisted));
      setProfile(actualProfile); setClient(new EkoClient(transport));
      setStats({ connected: true, connecting: false, kind: transport.kind, label: transport.label, latencyMs: Math.round(performance.now() - started), lastUpdated: new Date(), error: null });
    } catch (cause) {
      if (transport) { try { await transport.disconnect(); } catch { /* partial connection */ } }
      if (transportRef.current === transport) transportRef.current = null;
      const message = cause instanceof Error ? cause.message : "Could not connect to EKO";
      setStats({ connected: false, connecting: false, kind: nextProfile.kind, label: nextProfile.kind === "wifi" ? "Wi-Fi" : "Bluetooth", latencyMs: null, lastUpdated: null, error: message });
      throw cause;
    }
  }, [disconnect, receiveTelemetry]);

  const refresh = useCallback(async () => {
    if (!client) return;
    const started = performance.now();
    try {
      const [nextStatus, eventPayload] = await Promise.all([client.health(), client.events(100)]);
      pollFailures.current = 0;
      setStatus(nextStatus); mergeEvents(eventPayload.events);
      setStats((current) => ({ ...current, connected: true, latencyMs: Math.round(performance.now() - started), lastUpdated: new Date(), error: null }));
    } catch (cause) {
      pollFailures.current += 1;
      setStats((current) => ({ ...current, connected: pollFailures.current < 2 && current.connected, error: cause instanceof Error ? cause.message : "Telemetry refresh failed" }));
    }
  }, [client, mergeEvents]);

  const applySettings = useCallback((settings: RuntimeSettings) => setStatus((current) => current ? { ...current, settings } : current), []);

  useEffect(() => {
    if (!profile.autoReconnect || autoAttempted.current) return;
    autoAttempted.current = true;
    if (profile.kind === "wifi" || profile.bleDeviceId) void connect(profile).catch(() => undefined);
  }, [connect, profile]);

  useEffect(() => {
    if (!client || stats.kind !== "wifi") return;
    const interval = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(interval);
  }, [client, refresh, stats.kind]);

  return { profile, status, events, client, stats, connect, disconnect, refresh, applySettings, bleSupported: Boolean(navigator.bluetooth) };
}
