import { describe, expect, it } from "vitest";
import { eyeLayout } from "./eyeDisplay";
import type { EyeState } from "./types";

const state = (changes: Partial<EyeState> = {}): EyeState => ({
  expression: "idle", gaze_x: 0, gaze_y: 0, blink: false,
  source: "test", updated_at: 0, revision: 0, ...changes,
});

describe("128x64 eye preview geometry", () => {
  it("clamps gaze to the same safe display range as the Pi renderer", () => {
    expect(eyeLayout(state({ gaze_x: 4, gaze_y: -3 }))).toMatchObject({ pupilX: 88, pupilY: 21 });
  });

  it("renders sleeping and explicit blink states closed", () => {
    expect(eyeLayout(state({ expression: "sleeping" })).blink).toBe(true);
    expect(eyeLayout(state({ blink: true })).blink).toBe(true);
  });
});
