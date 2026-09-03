import { describe, expect, it } from "vitest";
import { mergeDebugLogs } from "./debugLogs";
import type { DebugLogEntry } from "./types";

const entry = (sequence: number, message = `message-${sequence}`): DebugLogEntry => ({
  sequence,
  timestamp: `2026-07-23T00:00:0${sequence}.000Z`,
  level: sequence % 2 ? "DEBUG" : "INFO",
  logger: "eko",
  thread: "MainThread",
  message,
  exception: null,
});

describe("mergeDebugLogs", () => {
  it("deduplicates, orders, and replaces records by sequence", () => {
    expect(mergeDebugLogs([entry(2), entry(1)], [entry(2, "updated"), entry(3)]))
      .toEqual([entry(1), entry(2, "updated"), entry(3)]);
  });

  it("keeps only the newest bounded records", () => {
    expect(mergeDebugLogs([], [entry(1), entry(2), entry(3)], 2).map((row) => row.sequence))
      .toEqual([2, 3]);
  });
});
