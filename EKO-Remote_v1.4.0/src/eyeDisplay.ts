import type { EyeState } from "./types";

export type EyeAdornment =
  | "none" | "listening" | "thinking" | "speaking" | "focus"
  | "camera" | "happy" | "surprised" | "error" | "angry" | "alert" | "sleeping";

export interface EyeLayout {
  pupilX: number;
  pupilY: number;
  pupilRadius: number;
  eyeRadius: number;
  eyeYRadius: number;
  blink: boolean;
  adornment: EyeAdornment;
}

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

export function eyeLayout(state: EyeState, side: "left" | "right" = "left"): EyeLayout {
  const expression = state.expression || "idle";
  let pupilX = 64 + clamp(state.gaze_x, -1, 1) * 14;
  let pupilY = 32 + clamp(state.gaze_y, -1, 1) * 13;
  if (expression === "thinking" && Math.abs(state.gaze_x) < 0.05 && Math.abs(state.gaze_y) < 0.05) {
    pupilX = side === "left" ? 72 : 56;
    pupilY = 23;
  }
  const adornments: Record<string, EyeAdornment> = {
    listening: "listening", thinking: "thinking", speaking: "speaking",
    determined: "focus", camera: "camera", happy: "happy",
    surprised: "surprised", error: "error", angry: "angry", alert: "alert", sleeping: "sleeping",
  };
  return {
    pupilX,
    pupilY,
    pupilRadius: expression === "surprised" ? 7 : expression === "determined" || expression === "camera" ? 9 : 11,
    eyeRadius: expression === "surprised" ? 31 : 27,
    eyeYRadius: expression === "surprised" ? 30 : 27,
    blink: Boolean(state.blink || expression === "sleeping"),
    adornment: adornments[expression] ?? "none",
  };
}
