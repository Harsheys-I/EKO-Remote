import type { MapPayload, MapPoint, MapPose } from "./types";

export interface ProjectedMap {
  points: Array<{ x: number; y: number }>;
  robot: { x: number; y: number; yaw: number };
  scale: number;
  left: number;
  top: number;
  floorWidth: number;
  floorHeight: number;
}

export function projectFloorPoint(projected: ProjectedMap, xM: number, yM: number) {
  return {
    x: projected.left + xM * projected.scale,
    y: projected.top + (projected.floorHeight - yM) * projected.scale,
  };
}

export function projectMap(map: Pick<MapPayload, "path" | "pose" | "layout">, width = 800, height = 500): ProjectedMap {
  const padding = 36;
  if (map.layout) {
    const floorWidth = Math.max(0.5, map.layout.width_m);
    const floorHeight = Math.max(0.5, map.layout.height_m);
    const scale = Math.min((width - padding * 2) / floorWidth, (height - padding * 2) / floorHeight);
    const left = (width - floorWidth * scale) / 2;
    const top = (height - floorHeight * scale) / 2;
    const shell = { scale, left, top, floorWidth, floorHeight };
    const point = (value: MapPose) => projectFloorPoint({ ...shell, points: [], robot: { x: 0, y: 0, yaw: 0 } }, value.x_m, value.y_m);
    return {
      ...shell,
      points: map.path.map(point),
      robot: { ...point(map.pose), yaw: map.pose.yaw_deg },
    };
  }

  const source: Array<MapPoint | MapPose> = [...map.path, map.pose];
  const xs = source.map((point) => Number.isFinite(point.x_m) ? point.x_m : 0);
  const ys = source.map((point) => Number.isFinite(point.y_m) ? point.y_m : 0);
  const minX = Math.min(...xs, -0.25); const maxX = Math.max(...xs, 0.25);
  const minY = Math.min(...ys, -0.25); const maxY = Math.max(...ys, 0.25);
  const floorWidth = Math.max(0.5, maxX - minX);
  const floorHeight = Math.max(0.5, maxY - minY);
  const scale = Math.min((width - padding * 2) / floorWidth, (height - padding * 2) / floorHeight);
  const left = (width - floorWidth * scale) / 2;
  const top = (height - floorHeight * scale) / 2;
  const point = (value: MapPose) => ({
    x: left + (value.x_m - minX) * scale,
    y: top + (maxY - value.y_m) * scale,
  });
  return {
    points: map.path.map(point),
    robot: { ...point(map.pose), yaw: map.pose.yaw_deg },
    scale, left, top, floorWidth, floorHeight,
  };
}
