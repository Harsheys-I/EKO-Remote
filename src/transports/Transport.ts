import type { EkoOperation, TelemetryMessage, TransportKind } from "../types";

export type TelemetryListener = (message: TelemetryMessage) => void;
export type DisconnectListener = (reason?: string) => void;

export interface EkoTransport {
  readonly kind: TransportKind;
  readonly label: string;
  readonly connected: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  request<T>(operation: EkoOperation, payload?: Record<string, unknown>): Promise<T>;
  send(operation: EkoOperation, payload?: Record<string, unknown>): Promise<void>;
  emergencyStop(): Promise<void>;
  subscribe(listener: TelemetryListener): () => void;
  onDisconnect(listener: DisconnectListener): () => void;
}

export abstract class TransportBase {
  protected telemetryListeners = new Set<TelemetryListener>();
  protected disconnectListeners = new Set<DisconnectListener>();

  subscribe(listener: TelemetryListener) { this.telemetryListeners.add(listener); return () => this.telemetryListeners.delete(listener); }
  onDisconnect(listener: DisconnectListener) { this.disconnectListeners.add(listener); return () => this.disconnectListeners.delete(listener); }
  protected emitTelemetry(message: TelemetryMessage) { this.telemetryListeners.forEach((listener) => listener(message)); }
  protected emitDisconnect(reason?: string) { this.disconnectListeners.forEach((listener) => listener(reason)); }
}
