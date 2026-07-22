import { describe, expect, it } from "vitest";
import { deadzone, gamepadVectorSignature, readGamepadVector } from "./gamepad";

const button = (pressed = false) => ({ pressed, touched: pressed, value: pressed ? 1 : 0 });

function gamepad(axes: number[], pressed: number[] = []) {
  const buttons = Array.from({ length: 16 }, (_, index) => button(pressed.includes(index)));
  return { axes, buttons } as Pick<Gamepad, "axes" | "buttons">;
}

describe("automatic gamepad mapping", () => {
  it("maps the original left-stick and bumper layout without a pairing state", () => {
    expect(readGamepadVector(gamepad([0.6, -0.8], [5]))).toEqual({ vx: 0.6, vy: 0.8, wz: 0.5 });
    expect(readGamepadVector(gamepad([-0.4, 0.3], [4]))).toEqual({ vx: -0.4, vy: -0.3, wz: -0.5 });
  });

  it("removes stick drift and ignores unrelated controller axes", () => {
    expect(deadzone(0.149)).toBe(0);
    expect(readGamepadVector(gamepad([0.04, -0.06, 0.7]))).toEqual({ vx: 0, vy: 0, wz: 0 });
  });

  it("cancels rotation when both bumpers are held", () => {
    const value = readGamepadVector(gamepad([0, 0], [4, 5]));
    expect(value.wz).toBe(0);
    expect(gamepadVectorSignature(value)).toBe("0.000:0.000:0.000");
  });
});
