import { describe, expect, it } from "vitest";
import { projectMap } from "./mapGeometry";

describe("house map projection", () => {
  it("fits translated meter coordinates into the SVG and preserves heading", () => {
    const projected = projectMap({
      path: [
        { x_m: 0, y_m: 0, yaw_deg: 0, timestamp: 1 },
        { x_m: 2, y_m: 1, yaw_deg: 30, timestamp: 2 },
      ],
      pose: { x_m: 2, y_m: 1, yaw_deg: 30 },
    });
    expect(projected.points).toHaveLength(2);
    expect(projected.robot.yaw).toBe(30);
    expect(projected.robot.x).toBeGreaterThan(0);
    expect(projected.robot.x).toBeLessThan(800);
    expect(projected.robot.y).toBeGreaterThan(0);
    expect(projected.robot.y).toBeLessThan(500);
  });
});
