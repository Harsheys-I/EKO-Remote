import type { DriveVector } from "./types";

export const GAMEPAD_DEADZONE = 0.15;

export function deadzone(value: number, threshold = GAMEPAD_DEADZONE) {
  return Number.isFinite(value) && Math.abs(value) >= threshold ? Math.max(-1, Math.min(1, value)) : 0;
}

export function readGamepadVector(gamepad: Pick<Gamepad, "axes" | "buttons">): DriveVector {
  const vx = deadzone(gamepad.axes[0] ?? 0);
  const vy = deadzone(-(gamepad.axes[1] ?? 0));
  const leftBumper = Boolean(gamepad.buttons[4]?.pressed);
  const rightBumper = Boolean(gamepad.buttons[5]?.pressed);
  let wz = 0;
  if (rightBumper) wz = 0.5;
  if (leftBumper) wz = -0.5;
  if (leftBumper && rightBumper) wz = 0;
  return { vx, vy, wz };
}

export function gamepadVectorSignature(vector: DriveVector) {
  return `${vector.vx.toFixed(3)}:${vector.vy.toFixed(3)}:${vector.wz.toFixed(3)}`;
}
