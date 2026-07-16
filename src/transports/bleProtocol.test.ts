import { describe, expect, it } from "vitest";
import { BleFrameKind, BleReassembler, decodeFrame, encodeFrames } from "./bleProtocol";

describe("BLE framing", () => {
  it("round-trips a multi-frame payload out of order", () => {
    const value = { operation: "message", payload: { text: "EKO ".repeat(180) } };
    const frames = encodeFrames(BleFrameKind.Request, 42, value);
    expect(frames.length).toBeGreaterThan(1);
    const reassembler = new BleReassembler();
    let complete = null;
    for (const bytes of [...frames].reverse()) complete = reassembler.push(decodeFrame(bytes)) ?? complete;
    expect(complete).toEqual({ kind: BleFrameKind.Request, messageId: 42, value });
  });

  it("rejects a malformed frame", () => {
    expect(() => decodeFrame(new Uint8Array([1, 2, 3]))).toThrow("too short");
  });
});
