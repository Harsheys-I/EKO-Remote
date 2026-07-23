import type { EkoOperation, StatusPayload, TelemetryMessage } from "../types";
import type { EkoTransport } from "./Transport";
import { TransportBase } from "./Transport";
import { websocketAuthProtocol, websocketUrl } from "./websocketAuth";

type Route = { path: string; method?: "GET" | "POST" | "DELETE"; body?: Record<string, unknown> };

export class WifiTransport extends TransportBase implements EkoTransport {
  readonly kind = "wifi" as const;
  readonly label: string;
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private active = false;

  constructor(private readonly baseUrl: string, private readonly token = "") {
    super();
    this.baseUrl = baseUrl.trim().replace(/\/$/, "");
    this.label = new URL(this.baseUrl).host;
  }

  get connected() { return this.active; }

  async connect() {
    if (window.location.protocol === "https:" && this.baseUrl.startsWith("http://")) {
      throw new Error("GitHub Pages requires an HTTPS/WSS EKO endpoint. Browsers block insecure HTTP from HTTPS pages.");
    }
    const status = await this.request<StatusPayload>("health");
    this.active = true;
    this.emitTelemetry({ type: "telemetry", sent_at: Date.now() / 1000, status, events: [] });
    this.openWebSocket();
  }

  async disconnect() {
    this.active = false;
    if (this.reconnectTimer !== null) { window.clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.socket) { this.socket.onclose = null; this.socket.close(); this.socket = null; }
  }

  async request<T>(operation: EkoOperation, payload: Record<string, unknown> = {}): Promise<T> {
    const route = this.route(operation, payload);
    const response = await fetch(`${this.baseUrl}${route.path}`, {
      method: route.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      ...(route.body ? { body: JSON.stringify(route.body) } : {}),
    });
    const value = await response.json() as T & { error?: string; response?: string };
    if (!response.ok) throw new Error(value.error ?? value.response ?? `EKO returned HTTP ${response.status}`);
    return value;
  }

  async send(operation: EkoOperation, payload: Record<string, unknown> = {}) { await this.request(operation, payload); }
  async emergencyStop() { await this.request("command", { command: "stop" }); }

  private route(operation: EkoOperation, payload: Record<string, unknown>): Route {
    switch (operation) {
      case "health": return { path: "/health" };
      case "events": return { path: `/events?limit=${encodeURIComponent(String(payload.limit ?? 100))}` };
      case "memories": return { path: `/memories?q=${encodeURIComponent(String(payload.query ?? ""))}&limit=${encodeURIComponent(String(payload.limit ?? 50))}` };
      case "memory.remember": return { path: "/memory", method: "POST", body: payload };
      case "memory.forget": return { path: `/memory/${encodeURIComponent(String(payload.id))}`, method: "DELETE" };
      case "chat.history": return { path: "/chat/history" };
      case "chat.forget": return { path: "/chat/history", method: "DELETE" };
      case "message": return { path: "/message", method: "POST", body: payload };
      case "command": return { path: "/command", method: "POST", body: payload };
      case "drive": return { path: "/drive", method: "POST", body: payload };
      case "control": return { path: "/control" };
      case "settings.get": return { path: "/settings" };
      case "settings.update": return { path: "/settings", method: "POST", body: payload };
      case "ai": return { path: "/ai" };
      case "vision.snapshot": return { path: "/vision/snapshot", method: "POST", body: {} };
      case "eyes.get": return { path: "/eyes" };
      case "eyes.expression": return { path: "/eyes/expression", method: "POST", body: payload };
      case "faces.list": return { path: "/faces" };
      case "faces.enroll": return { path: "/faces/enroll", method: "POST", body: { name: payload.name } };
      case "faces.delete": return { path: `/faces/${encodeURIComponent(String(payload.face_id))}`, method: "DELETE" };
      case "follow.get": return { path: "/vision/follow" };
      case "follow.start": return { path: "/vision/follow/start", method: "POST", body: {} };
      case "follow.stop": return { path: "/vision/follow/stop", method: "POST", body: {} };
      case "map.get": return { path: "/map" };
      case "map.reset": return { path: "/map/reset", method: "POST", body: {} };
      case "config.list": return { path: "/config" };
      case "config.update": return { path: `/config/${encodeURIComponent(String(payload.name))}`, method: "POST", body: { values: payload.values } };
      case "config.batch": return { path: "/config/batch", method: "POST", body: { changes: payload.changes, dry_run: payload.dry_run } };
      case "wifi.profiles": return { path: "/wifi/profiles" };
      case "wifi.profiles.update": return { path: "/wifi/profiles", method: "POST", body: { profiles: payload.profiles } };
      case "debug.logs": return { path: `/debug/logs?limit=${encodeURIComponent(String(payload.limit ?? 300))}&after=${encodeURIComponent(String(payload.after ?? 0))}` };
      case "terminal.status": return { path: "/terminal/status" };
    }
  }

  private openWebSocket() {
    const endpoint = websocketUrl(this.baseUrl, "/ws");
    const protocol = this.token ? websocketAuthProtocol(this.token) : undefined;
    const socket = protocol ? new WebSocket(endpoint, [protocol]) : new WebSocket(endpoint);
    this.socket = socket;
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as TelemetryMessage;
        if (message.type === "telemetry") this.emitTelemetry(message);
      } catch { /* malformed telemetry is ignored; HTTP remains available */ }
    };
    socket.onclose = () => { if (this.active) { this.socket = null; this.reconnectTimer = window.setTimeout(() => this.openWebSocket(), 3000); } };
    socket.onerror = () => socket.close();
  }

}
