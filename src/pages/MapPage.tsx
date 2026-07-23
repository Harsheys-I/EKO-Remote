import { Compass, LocateFixed, MousePointer2, RefreshCw, RotateCcw, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { EkoClient } from "../client";
import { EmptyState, Panel, SectionHeading } from "../components/Common";
import { projectMap } from "../mapGeometry";
import type { LinkStats, MapPayload } from "../types";

const meters = (value: number | undefined) => value == null ? "—" : `${value.toFixed(2)} m`;

export function MapPage({ client, stats }: { client: EkoClient | null; stats: LinkStats }) {
  const [map, setMap] = useState<MapPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    try { setMap(await client.map()); setError(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load the house map"); }
    finally { setLoading(false); }
  }, [client]);
  useEffect(() => {
    void refresh();
    if (!client || !stats.connected) return undefined;
    const interval = window.setInterval(() => void refresh(), 1250);
    return () => window.clearInterval(interval);
  }, [client, refresh, stats.connected]);
  const projected = useMemo(() => map ? projectMap(map) : null, [map]);
  const reset = async () => {
    if (!client || !window.confirm("Reset EKO's accumulated house-map trail and current pose?")) return;
    try { setMap(await client.resetMap()); setError(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not reset the map"); }
  };
  const polyline = projected?.points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ") ?? "";
  return <div className="page-grid map-page">
    <Panel className="map-canvas-panel"><SectionHeading kicker="DEAD-RECKONING TRAIL" title="House map" action={<div className="heading-actions"><button className="icon-button" onClick={() => void refresh()} disabled={!client || loading} title="Refresh map"><RefreshCw className={loading ? "spin" : ""} size={16} /></button><button className="secondary-button map-reset" onClick={() => void reset()} disabled={!client}><RotateCcw size={15} />Reset trail</button></div>} />
      <div className="house-map-surface">
        {map && projected ? <svg viewBox="0 0 800 500" role="img" aria-label="EKO optical mouse house-map trail">
          <defs><pattern id="map-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1b3e57" strokeWidth="1" /></pattern></defs>
          <rect width="800" height="500" fill="url(#map-grid)" />
          <line x1="400" y1="0" x2="400" y2="500" stroke="#28516e" strokeDasharray="4 8" /><line x1="0" y1="250" x2="800" y2="250" stroke="#28516e" strokeDasharray="4 8" />
          {polyline && <polyline points={polyline} fill="none" stroke="#4aa9ff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
          {projected.points.map((point, index) => index % Math.max(1, Math.floor(projected.points.length / 80)) === 0 ? <circle key={index} cx={point.x} cy={point.y} r="2.4" fill="#89d5ff" /> : null)}
          <g transform={`translate(${projected.robot.x} ${projected.robot.y}) rotate(${projected.robot.yaw})`}><circle r="19" fill="#0f3147" stroke="#50e2cd" strokeWidth="3" /><path d="M 0 -23 L 8 -8 L -8 -8 Z" fill="#50e2cd" /><text y="5" textAnchor="middle" fill="#e8ffff" fontSize="9" fontWeight="700">EKO</text></g>
        </svg> : <EmptyState icon={LocateFixed} title="No odometry received" message="Enable the optical-mouse map module on the Pi, then move EKO to build a trail." />}
      </div>{error && <p className="inline-error">{error}</p>}
    </Panel>
    <div className="map-sidebar">
      <Panel><SectionHeading kicker="CURRENT POSE" title="Position" action={<Compass size={19} />} /><dl className="detail-list"><div><dt>X translation</dt><dd>{meters(map?.pose.x_m)}</dd></div><div><dt>Y translation</dt><dd>{meters(map?.pose.y_m)}</dd></div><div><dt>MPU heading</dt><dd>{map ? `${map.pose.yaw_deg.toFixed(1)}°` : "—"}</dd></div><div><dt>Trail points</dt><dd>{map?.path.length ?? 0}</dd></div></dl></Panel>
      <Panel><SectionHeading kicker="SENSORS" title="Fusion status" action={<MousePointer2 size={19} />} /><dl className="detail-list"><div><dt>Optical mouse</dt><dd className={map?.status.connected ? "ready" : "disabled"}>{map?.status.connected ? map.status.device_name ?? "Connected" : map?.status.enabled ? "Waiting" : "Disabled"}</dd></div><div><dt>Nano yaw</dt><dd>{map?.status.last_yaw_at ? "Receiving" : "Waiting"}</dd></div><div><dt>Quality</dt><dd>Dead reckoning</dd></div></dl>{map?.status.last_error && <p className="inline-error">{map.status.last_error}</p>}</Panel>
      <div className="map-caution"><TriangleAlert size={19} /><p>This is a relative motion trail, not SLAM. Mouse lift, wheel slip, floor texture, and MPU drift accumulate error; reset it at a known origin before each mapping run.</p></div>
    </div>
  </div>;
}
