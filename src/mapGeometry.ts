import type { MapPayload, MapPoint, MapPose } from "./types";

export interface ProjectedMap {
  points: Array<{ x: number; y: number }>;
  robot: { x: number; y: number; yaw: number };
  scale: number;
}

export function projectMap(map: Pick<MapPayload, "path" | "pose">, width = 800, height = 500): ProjectedMap {
  const source: Array<MapPoint | MapPose> = [...map.path, map.pose];
  const xs = source.map((point) => Number.isFinite(point.x_m) ? point.x_m : 0);
  const ys = source.map((point) => Number.isFinite(point.y_m) ? point.y_m : 0);
  const minX = Math.min(...xs, -0.25); const maxX = Math.max(...xs, 0.25);
  const minY = Math.min(...ys, -0.25); const maxY = Math.max(...ys, 0.25);
  const padding = 36;
  const scale = Math.min((width - padding * 2) / Math.max(0.5, maxX - minX), (height - padding * 2) / Math.max(0.5, maxY - minY));
  const contentWidth = (maxX - minX) * scale;
  const contentHeight = (maxY - minY) * scale;
  const left = (width - contentWidth) / 2;
  const top = (height - contentHeight) / 2;
  const point = (value: MapPose) => ({
    x: left + (value.x_m - minX) * scale,
    y: top + (maxY - value.y_m) * scale,
  });
  return {
    points: map.path.map(point),
    robot: { ...point(map.pose), yaw: map.pose.yaw_deg },
    scale,
  };
}
