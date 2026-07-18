export const BLE_FRAME_VERSION = 1;
export const BLE_FRAME_BYTES = 180;
export const BLE_HEADER_BYTES = 8;
export const BLE_PAYLOAD_BYTES = BLE_FRAME_BYTES - BLE_HEADER_BYTES;

export enum BleFrameKind { Request = 1, Response = 2, Telemetry = 3, Event = 4, Error = 5 }

export interface BleFrame { kind: BleFrameKind; messageId: number; chunkIndex: number; chunkCount: number; payload: Uint8Array; }

export function encodeFrames(kind: BleFrameKind, messageId: number, value: unknown): Uint8Array[] {
  const payload = new TextEncoder().encode(JSON.stringify(value));
  const chunkCount = Math.max(1, Math.ceil(payload.length / BLE_PAYLOAD_BYTES));
  if (chunkCount > 0xffff) throw new Error("BLE message exceeds protocol limit");
  const frames: Uint8Array[] = [];
  for (let index = 0; index < chunkCount; index += 1) {
    const chunk = payload.slice(index * BLE_PAYLOAD_BYTES, (index + 1) * BLE_PAYLOAD_BYTES);
    const frame = new Uint8Array(BLE_HEADER_BYTES + chunk.length);
    const view = new DataView(frame.buffer);
    view.setUint8(0, BLE_FRAME_VERSION);
    view.setUint8(1, kind);
    view.setUint16(2, messageId, false);
    view.setUint16(4, index, false);
    view.setUint16(6, chunkCount, false);
    frame.set(chunk, BLE_HEADER_BYTES);
    frames.push(frame);
  }
  return frames;
}

export function decodeFrame(value: DataView | Uint8Array): BleFrame {
  const bytes = value instanceof Uint8Array
    ? value
    : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (bytes.byteLength < BLE_HEADER_BYTES) throw new Error("BLE frame is too short");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint8(0) !== BLE_FRAME_VERSION) throw new Error("Unsupported BLE protocol version");
  const chunkIndex = view.getUint16(4, false);
  const chunkCount = view.getUint16(6, false);
  if (!chunkCount || chunkIndex >= chunkCount) throw new Error("Invalid BLE chunk metadata");
  return { kind: view.getUint8(1) as BleFrameKind, messageId: view.getUint16(2, false), chunkIndex, chunkCount, payload: bytes.slice(BLE_HEADER_BYTES) };
}

export class BleReassembler {
  private messages = new Map<string, { chunks: Array<Uint8Array | undefined>; received: number; expires: number }>();

  push(frame: BleFrame): { kind: BleFrameKind; messageId: number; value: unknown } | null {
    const key = `${frame.kind}:${frame.messageId}`;
    const now = Date.now();
    for (const [candidate, message] of this.messages) if (message.expires < now) this.messages.delete(candidate);
    let message = this.messages.get(key);
    if (!message || message.chunks.length !== frame.chunkCount) {
      message = { chunks: new Array(frame.chunkCount), received: 0, expires: now + 30_000 };
      this.messages.set(key, message);
    }
    if (!message.chunks[frame.chunkIndex]) { message.chunks[frame.chunkIndex] = frame.payload; message.received += 1; }
    message.expires = now + 30_000;
    if (message.received !== frame.chunkCount) return null;
    this.messages.delete(key);
    const total = message.chunks.reduce((sum, chunk) => sum + (chunk?.length ?? 0), 0);
    const complete = new Uint8Array(total);
    let offset = 0;
    message.chunks.forEach((chunk) => { if (chunk) { complete.set(chunk, offset); offset += chunk.length; } });
    return { kind: frame.kind, messageId: frame.messageId, value: JSON.parse(new TextDecoder().decode(complete)) as unknown };
  }
}
