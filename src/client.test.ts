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
});
