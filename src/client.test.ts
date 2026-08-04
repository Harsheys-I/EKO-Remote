import { describe, expect, it, vi } from "vitest";
import { EkoClient } from "./client";
import type { EkoTransport } from "./transports/Transport";
import type { EkoOperation } from "./types";

function transport() {
  const request = vi.fn(async (_operation: EkoOperation, _payload?: Record<string, unknown>) => ({
    enabled: true,
    exact_exchanges: 0,
  }));
  const value = {
    kind: "wifi" as const,
    label: "test",
    connected: true,
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    request: async <T>(operation: EkoOperation, payload?: Record<string, unknown>): Promise<T> => {
      const result = payload === undefined
        ? await request(operation)
        : await request(operation, payload);
      return result as T;
    },
    send: vi.fn(async () => undefined),
    emergencyStop: vi.fn(async () => undefined),
    subscribe: vi.fn(() => () => undefined),
    onDisconnect: vi.fn(() => () => undefined),
  } satisfies EkoTransport;
  return { value, request };
}

describe("EkoClient temporary CHAT operations", () => {
  it("requests history metadata without asking for transcript contents", async () => {
    const link = transport();
    await new EkoClient(link.value).chatHistory();
    expect(link.request).toHaveBeenCalledWith("chat.history");
  });

  it("uses the isolated temporary-history reset operation", async () => {
    const link = transport();
    await new EkoClient(link.value).forgetChatHistory();
    expect(link.request).toHaveBeenCalledWith("chat.forget");
  });

  it("loads structured fallback Wi-Fi profiles", async () => {
    const link = transport();
    await new EkoClient(link.value).wifiProfiles();
    expect(link.request).toHaveBeenCalledWith("wifi.profiles");
  });

  it("updates fallback profiles without inventing a raw config operation", async () => {
    const link = transport();
    const profiles = [{ id: "a".repeat(24), ssid: "EKO backup", priority: 10, password_set: false, password: "correct-horse" }];
    await new EkoClient(link.value).updateWifiProfiles(profiles);
    expect(link.request).toHaveBeenCalledWith("wifi.profiles.update", { profiles });
  });

  it("dry-runs the complete config candidate before the caller applies it", async () => {
    const link = transport();
    const changes = { "hardware.yaml": { "motors.deadzone": 0.12 }, "sensors.yaml": { distance_threshold_cm: 30 } };
    await new EkoClient(link.value).validateConfigBatch(changes);
    expect(link.request).toHaveBeenCalledWith("config.batch", { changes, dry_run: true });
  });

  it("applies all staged config files in one operation", async () => {
    const link = transport();
    const changes = { "audio.yaml": { enabled: true } };
    await new EkoClient(link.value).applyConfigBatch(changes);
    expect(link.request).toHaveBeenCalledWith("config.batch", { changes, dry_run: false });
  });

  it("uses dedicated debug-log and terminal status operations", async () => {
    const link = transport();
    const client = new EkoClient(link.value);
    await client.debugLogs(250, 9);
    await client.terminalStatus();
    expect(link.request).toHaveBeenCalledWith("debug.logs", { limit: 250, after: 9 });
    expect(link.request).toHaveBeenCalledWith("terminal.status");
  });

  it("uses dedicated perception, eye, follow, and map operations", async () => {
    const link = transport();
    const client = new EkoClient(link.value);
    await client.eyes();
    await client.enrollFace("Harshit");
    await client.startFollowing();
    await client.map();
    expect(link.request).toHaveBeenCalledWith("eyes.get");
    expect(link.request).toHaveBeenCalledWith("faces.enroll", { name: "Harshit" });
    expect(link.request).toHaveBeenCalledWith("follow.start");
    expect(link.request).toHaveBeenCalledWith("map.get");
  });

  it("updates the robot voice-reply gate used by the AI page", async () => {
    const link = transport();
    await new EkoClient(link.value).updateSettings({ voice_responses: true });
    expect(link.request).toHaveBeenCalledWith("settings.update", {
      voice_responses: true,
    });
  });
});
