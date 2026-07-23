import type { EyeState } from "./types";

export interface EyeLayout {
  pupilX: number;
  pupilY: number;
  pupilRx: number;
  pupilRy: number;
  eyeRx: number;
  eyeRy: number;
  blink: boolean;
}

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

export function eyeLayout(state: EyeState): EyeLayout {
  const expression = state.expression || "idle";
  return {
    pupilX: 64 + clamp(state.gaze_x, -1, 1) * 24,
    pupilY: 32 + clamp(state.gaze_y, -1, 1) * 11,
    pupilRx: expression === "surprised" ? 9 : 14,
    pupilRy: expression === "speaking" || expression === "happy" ? 13 : 19,
    eyeRx: expression === "thinking" || expression === "camera" ? 49 : 53,
    eyeRy: expression === "listening" ? 27 : expression === "speaking" ? 20 : 25,
    blink: Boolean(state.blink || expression === "sleeping"),
  };
}
