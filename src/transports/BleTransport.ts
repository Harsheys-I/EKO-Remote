import type { EkoOperation, StatusPayload, TelemetryMessage } from "../types";
import { BleFrameKind, BleReassembler, decodeFrame, encodeFrames } from "./bleProtocol";
import { EKO_BLE_COMMAND, EKO_BLE_NAME_PREFIX, EKO_BLE_SERVICE, EKO_BLE_STOP, EKO_BLE_TELEMETRY } from "./constants";
import type { EkoTransport } from "./Transport";
import { TransportBase } from "./Transport";

interface PendingRequest { resolve: (value: unknown) => void; reject: (reason: Error) => void; timer: number; }
interface BleResponse { ok: boolean; data?: unknown; error?: string; }

export class BleTransport extends TransportBase implements EkoTransport {
  readonly kind = "ble" as const;
  private device: BluetoothDevice | null = null;
  private command: BluetoothRemoteGATTCharacteristic | null = null;
  private telemetry: BluetoothRemoteGATTCharacteristic | null = null;
  private stopCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private reassembler = new BleReassembler();
  private pending = new Map<number, PendingRequest>();
  private nextMessageId = 1;
  private writeQueue: Promise<void> = Promise.resolve();
  private intentionalDisconnect = false;

  constructor(private readonly preferredDeviceId = "", private readonly token = "") { super(); }
  get label() { return this.device?.name || "EKO BLE"; }
  get connected() { return Boolean(this.device?.gatt?.connected && this.command); }

  async connect() {
    const bluetooth = navigator.bluetooth;
    if (!bluetooth) throw new Error("Web Bluetooth is unavailable. Use current Chrome or Edge on a supported device, or connect over Wi-Fi.");
    if (bluetooth.getAvailability && !(await bluetooth.getAvailability())) throw new Error("Bluetooth is turned off or unavailable on this device.");
    this.intentionalDisconnect = false;
    let device: BluetoothDevice | undefined;
    if (this.preferredDeviceId && bluetooth.getDevices) {
      device = (await bluetooth.getDevices()).find((candidate) => candidate.id === this.preferredDeviceId);
    }
    this.device = device ?? await bluetooth.requestDevice({
      filters: [{ namePrefix: EKO_BLE_NAME_PREFIX }],
      optionalServices: [EKO_BLE_SERVICE],
    });
    if (!this.device.gatt) throw new Error("The selected BLE device does not expose a GATT server.");
    this.device.addEventListener("gattserverdisconnected", this.handleDisconnect);
    const server = await this.device.gatt.connect();
    const service = await server.getPrimaryService(EKO_BLE_SERVICE);
    this.command = await service.getCharacteristic(EKO_BLE_COMMAND);
    this.telemetry = await service.getCharacteristic(EKO_BLE_TELEMETRY);
    this.stopCharacteristic = await service.getCharacteristic(EKO_BLE_STOP);
    this.telemetry.addEventListener("characteristicvaluechanged", this.handleNotification);
    await this.telemetry.startNotifications();
    const status = await this.request<StatusPayload>("health");
    this.emitTelemetry({ type: "telemetry", sent_at: Date.now() / 1000, status, events: [] });
  }

  async disconnect() {
    this.intentionalDisconnect = true;
    this.pending.forEach(({ reject, timer }) => { window.clearTimeout(timer); reject(new Error("BLE disconnected")); });
    this.pending.clear();
    if (this.telemetry) {
      this.telemetry.removeEventListener("characteristicvaluechanged", this.handleNotification);
      try { await this.telemetry.stopNotifications(); } catch { /* already disconnected */ }
    }
    this.device?.gatt?.disconnect();
    this.command = null; this.telemetry = null; this.stopCharacteristic = null;
  }

  async request<T>(operation: EkoOperation, payload: Record<string, unknown> = {}): Promise<T> {
    const messageId = this.allocateMessageId();
    const promise = new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => { this.pending.delete(messageId); reject(new Error(`BLE request timed out: ${operation}`)); }, operation === "vision.snapshot" ? 90_000 : 12_000);
      this.pending.set(messageId, { resolve: (value) => resolve(value as T), reject, timer });
    });
    try { await this.writeFrames(encodeFrames(BleFrameKind.Request, messageId, { operation, payload, auth: this.token })); }
    catch (cause) { const pending = this.pending.get(messageId); if (pending) { window.clearTimeout(pending.timer); this.pending.delete(messageId); pending.reject(cause instanceof Error ? cause : new Error("BLE write failed")); } }
    return promise;
  }

  async send(operation: EkoOperation, payload: Record<string, unknown> = {}) {
    await this.writeFrames(encodeFrames(BleFrameKind.Request, this.allocateMessageId(), { operation, payload, auth: this.token, noReply: true }));
  }

  async emergencyStop() {
    if (!this.stopCharacteristic) throw new Error("BLE stop characteristic is unavailable");
    await this.queueWrite(this.stopCharacteristic, new Uint8Array([1]));
  }

  get deviceId() { return this.device?.id ?? ""; }

  private allocateMessageId() { const value = this.nextMessageId; this.nextMessageId = this.nextMessageId >= 0xffff ? 1 : this.nextMessageId + 1; return value; }

  private async writeFrames(frames: Uint8Array[]) {
    if (!this.command) throw new Error("BLE is not connected");
    for (const frame of frames) await this.queueWrite(this.command, frame);
  }

  private async queueWrite(characteristic: BluetoothRemoteGATTCharacteristic, bytes: Uint8Array) {
    const write = async () => {
      const payload = Uint8Array.from(bytes).buffer;
      if (characteristic.properties.writeWithoutResponse) await characteristic.writeValueWithoutResponse(payload);
      else await characteristic.writeValueWithResponse(payload);
    };
    this.writeQueue = this.writeQueue.catch(() => undefined).then(write);
    await this.writeQueue;
  }

  private handleNotification = (event: Event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (!value) return;
    try {
      const complete = this.reassembler.push(decodeFrame(value));
      if (!complete) return;
      if (complete.kind === BleFrameKind.Telemetry) {
        this.emitTelemetry(complete.value as TelemetryMessage);
        return;
      }
      const pending = this.pending.get(complete.messageId);
      if (!pending) return;
      window.clearTimeout(pending.timer); this.pending.delete(complete.messageId);
      const response = complete.value as BleResponse;
      if (response.ok) pending.resolve(response.data);
      else pending.reject(new Error(response.error || "BLE request failed"));
    } catch { /* corrupt/incomplete packets are discarded */ }
  };

  private handleDisconnect = () => {
    this.command = null; this.telemetry = null; this.stopCharacteristic = null;
    if (!this.intentionalDisconnect) this.emitDisconnect("Bluetooth link lost");
  };
}
