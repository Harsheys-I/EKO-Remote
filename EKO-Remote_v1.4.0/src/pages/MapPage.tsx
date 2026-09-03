import { BedDouble, Compass, Crosshair, DoorOpen, LocateFixed, MousePointer2, Octagon, Play, Plus, RefreshCw, RotateCcw, Route as RouteIcon, Save, Sofa, Trash2, TriangleAlert, VectorSquare } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import type { EkoClient } from "../client";
import { EmptyState, Panel, SectionHeading } from "../components/Common";
import { projectFloorPoint, projectMap } from "../mapGeometry";
import type { FloorObjectType, FloorPlan, FloorRoomType, LinkStats, MapPayload, NavigationRoute } from "../types";

const meters = (value: number | undefined) => value == null ? "—" : `${value.toFixed(2)} m`;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const roomTypes: FloorRoomType[] = ["room", "bedroom", "living_room", "kitchen", "bathroom", "dining_room", "hallway", "balcony", "utility", "office", "garage", "other"];
const objectTypes: FloorObjectType[] = ["sofa", "bed", "table", "chair", "wardrobe", "cabinet", "toilet", "sink", "bathtub", "shower", "appliance", "desk", "shelf", "plant", "custom"];
type Selection = { kind: "rooms" | "walls" | "doors" | "objects"; id: string } | null;

function NumberField({ label, value, min = 0, max = 100, step = 0.1, onChange }: { label: string; value: number; min?: number; max?: number; step?: number; onChange: (value: number) => void }) {
  return <label><span>{label}</span><input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function FloorPlanInspector({ plan, selection, updatePlan, updateSelected, removeSelected }: {
  plan: FloorPlan;
  selection: Selection;
  updatePlan: (patch: Partial<FloorPlan>) => void;
  updateSelected: (patch: Record<string, string | number>) => void;
  removeSelected: () => void;
}) {
  const selectedRoom = selection?.kind === "rooms" ? plan.rooms.find((item) => item.id === selection.id) : undefined;
  const selectedWall = selection?.kind === "walls" ? plan.walls.find((item) => item.id === selection.id) : undefined;
  const selectedDoor = selection?.kind === "doors" ? plan.doors.find((item) => item.id === selection.id) : undefined;
  const selectedObject = selection?.kind === "objects" ? plan.objects.find((item) => item.id === selection.id) : undefined;
  const selected = selectedRoom ?? selectedWall ?? selectedDoor ?? selectedObject;
  return <div className="floor-inspector">
    <div className="floor-form-grid">
      <label className="wide"><span>Plan name</span><input value={plan.name} maxLength={80} onChange={(event) => updatePlan({ name: event.target.value })} /></label>
      <NumberField label="Width (m)" value={plan.width_m} min={0.5} onChange={(width_m) => updatePlan({ width_m })} />
      <NumberField label="Height (m)" value={plan.height_m} min={0.5} onChange={(height_m) => updatePlan({ height_m })} />
    </div>
    <div className="inspector-divider" />
    {!selection || !selected ? <p className="muted-copy">Select a room, wall, door, or object on the plan to edit its exact measurements.</p> : <>
      <div className="selected-row"><strong>{selection.kind.slice(0, -1).toUpperCase()}</strong><button className="danger-icon" onClick={removeSelected} title="Delete selected"><Trash2 size={15} /></button></div>
      <div className="floor-form-grid">
        {selectedRoom && <>
          <label className="wide"><span>Room name</span><input value={selectedRoom.name} onChange={(event) => updateSelected({ name: event.target.value })} /></label>
          <label className="wide"><span>Room type</span><select value={selectedRoom.type} onChange={(event) => updateSelected({ type: event.target.value })}>{roomTypes.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
          <NumberField label="X (m)" value={selectedRoom.x_m} onChange={(x_m) => updateSelected({ x_m })} />
          <NumberField label="Y (m)" value={selectedRoom.y_m} onChange={(y_m) => updateSelected({ y_m })} />
          <NumberField label="Width (m)" value={selectedRoom.width_m} min={0.1} onChange={(width_m) => updateSelected({ width_m })} />
          <NumberField label="Height (m)" value={selectedRoom.height_m} min={0.1} onChange={(height_m) => updateSelected({ height_m })} />
        </>}
        {selectedWall && <>
          <NumberField label="Start X" value={selectedWall.x1_m} onChange={(x1_m) => updateSelected({ x1_m })} />
          <NumberField label="Start Y" value={selectedWall.y1_m} onChange={(y1_m) => updateSelected({ y1_m })} />
          <NumberField label="End X" value={selectedWall.x2_m} onChange={(x2_m) => updateSelected({ x2_m })} />
          <NumberField label="End Y" value={selectedWall.y2_m} onChange={(y2_m) => updateSelected({ y2_m })} />
          <NumberField label="Thickness" value={selectedWall.thickness_m} min={0.02} max={1} step={0.02} onChange={(thickness_m) => updateSelected({ thickness_m })} />
        </>}
        {selectedDoor && <>
          <label className="wide"><span>Door label</span><input value={selectedDoor.label} onChange={(event) => updateSelected({ label: event.target.value })} /></label>
          <NumberField label="Center X" value={selectedDoor.x_m} onChange={(x_m) => updateSelected({ x_m })} />
          <NumberField label="Center Y" value={selectedDoor.y_m} onChange={(y_m) => updateSelected({ y_m })} />
          <NumberField label="Width" value={selectedDoor.width_m} min={0.3} max={4} onChange={(width_m) => updateSelected({ width_m })} />
          <NumberField label="Rotation °" value={selectedDoor.rotation_deg} min={-360} max={360} step={5} onChange={(rotation_deg) => updateSelected({ rotation_deg })} />
        </>}
        {selectedObject && <>
          <label className="wide"><span>Object type</span><select value={selectedObject.type} onChange={(event) => updateSelected({ type: event.target.value })}>{objectTypes.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
          <label className="wide"><span>Label</span><input value={selectedObject.label} onChange={(event) => updateSelected({ label: event.target.value })} /></label>
          <NumberField label="X (m)" value={selectedObject.x_m} onChange={(x_m) => updateSelected({ x_m })} />
          <NumberField label="Y (m)" value={selectedObject.y_m} onChange={(y_m) => updateSelected({ y_m })} />
          <NumberField label="Width" value={selectedObject.width_m} min={0.05} onChange={(width_m) => updateSelected({ width_m })} />
          <NumberField label="Height" value={selectedObject.height_m} min={0.05} onChange={(height_m) => updateSelected({ height_m })} />
          <NumberField label="Rotation °" value={selectedObject.rotation_deg} min={-360} max={360} step={5} onChange={(rotation_deg) => updateSelected({ rotation_deg })} />
        </>}
      </div>
    </>}
  </div>;
}

export function MapPage({ client, stats }: { client: EkoClient | null; stats: LinkStats }) {
  const [map, setMap] = useState<MapPayload | null>(null);
  const [draft, setDraft] = useState<FloorPlan | null>(null);
  const [dirty, setDirty] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [destination, setDestination] = useState("");
  const [coordinateTarget, setCoordinateTarget] = useState<{ x_m: number; y_m: number; label: string } | null>(null);
  const [returnToStart, setReturnToStart] = useState(false);
  const [pickTarget, setPickTarget] = useState(false);
  const [navigationBusy, setNavigationBusy] = useState(false);
  const [plannedRoute, setPlannedRoute] = useState<NavigationRoute | null>(null);
  const refresh = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    try {
      const next = await client.map();
      setMap(next);
      if (!dirty && next.layout) setDraft(clone(next.layout));
      setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load the house map"); }
    finally { setLoading(false); }
  }, [client, dirty]);
  useEffect(() => {
    void refresh();
    if (!client || !stats.connected) return undefined;
    const interval = window.setInterval(() => void refresh(), 1250);
    return () => window.clearInterval(interval);
  }, [client, refresh, stats.connected]);

  const displayMap = useMemo(() => map && draft ? { ...map, layout: draft } : map, [map, draft]);
  const projected = useMemo(() => displayMap ? projectMap(displayMap) : null, [displayMap]);
  const updatePlan = (patch: Partial<FloorPlan>) => { setDraft((current) => current ? { ...current, ...patch } : current); setDirty(true); };
  const updateSelected = (patch: Record<string, string | number>) => {
    if (!selection) return;
    setDraft((current) => current ? { ...current, [selection.kind]: current[selection.kind].map((item) => item.id === selection.id ? { ...item, ...patch } : item) } : current);
    setDirty(true);
  };
  const removeSelected = () => {
    if (!selection) return;
    setDraft((current) => current ? { ...current, [selection.kind]: current[selection.kind].filter((item) => item.id !== selection.id) } : current);
    setSelection(null); setDirty(true);
  };
  const add = (kind: NonNullable<Selection>["kind"], subtype?: string) => {
    if (!draft) return;
    const centerX = draft.width_m / 2; const centerY = draft.height_m / 2;
    const id = makeId(kind.slice(0, -1));
    const item = kind === "rooms"
      ? { id, name: subtype === "bathroom" ? "Bathroom" : "New room", type: (subtype ?? "room") as FloorRoomType, x_m: Math.max(0, centerX - 1.5), y_m: Math.max(0, centerY - 1), width_m: Math.min(3, draft.width_m), height_m: Math.min(2, draft.height_m) }
      : kind === "walls"
        ? { id, x1_m: 0.25, y1_m: centerY, x2_m: Math.max(0.25, draft.width_m - 0.25), y2_m: centerY, thickness_m: 0.12 }
        : kind === "doors"
          ? { id, label: "Door", x_m: centerX, y_m: centerY, width_m: 0.9, rotation_deg: 0 }
          : { id, type: (subtype ?? "sofa") as FloorObjectType, label: (subtype ?? "sofa").replaceAll("_", " "), x_m: Math.max(0, centerX - 0.75), y_m: Math.max(0, centerY - 0.4), width_m: Math.min(1.5, draft.width_m), height_m: Math.min(0.8, draft.height_m), rotation_deg: 0 };
    setDraft({ ...draft, [kind]: [...draft[kind], item] } as FloorPlan);
    setSelection({ kind, id }); setDirty(true);
  };
  const save = async () => {
    if (!client || !draft) return;
    setSaving(true);
    try { const result = await client.saveFloorPlan(draft); setMap(result.map); setDraft(clone(result.layout)); setDirty(false); setError(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the floor plan"); }
    finally { setSaving(false); }
  };
  const reset = async () => {
    if (!client || !window.confirm("Reset EKO's accumulated tracking trail and current pose? The floor layout will be kept.")) return;
    try { setMap(await client.resetMap()); setError(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not reset the map"); }
  };
  const polyline = projected?.points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ") ?? "";
  const selected = (kind: NonNullable<Selection>["kind"], id: string) => selection?.kind === kind && selection.id === id;
  const target = coordinateTarget ?? destination.trim();
  const route = plannedRoute ?? map?.navigation?.route ?? null;
  const routePoints = route && projected ? route.waypoints.map((point) => projectFloorPoint(projected, point.x_m, point.y_m)) : [];
  const routePolyline = routePoints.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const obstacles = map?.navigation?.memory.obstacles ?? [];
  const navigationAction = async (kind: "plan" | "go" | "stop" | "relocalize") => {
    if (!client) return;
    if ((kind === "plan" || kind === "go") && !target) { setError("Choose a room, object, or map point first."); return; }
    setNavigationBusy(true); setError(null);
    try {
      if (kind === "plan") setPlannedRoute((await client.planNavigation(target)).plan);
      else if (kind === "go") await client.navigate(target, returnToStart);
      else if (kind === "stop") await client.stopNavigation();
      else await client.relocalize();
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Navigation request failed"); }
    finally { setNavigationBusy(false); }
  };
  const chooseMapPoint = (event: MouseEvent<SVGSVGElement>) => {
    if (!pickTarget || !projected || !draft) { setSelection(null); return; }
    const bounds = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - bounds.left) * 800 / bounds.width;
    const py = (event.clientY - bounds.top) * 500 / bounds.height;
    const x_m = Math.max(0, Math.min(draft.width_m, (px - projected.left) / projected.scale));
    const floorBottom = projected.top + draft.height_m * projected.scale;
    const y_m = Math.max(0, Math.min(draft.height_m, (floorBottom - py) / projected.scale));
    setCoordinateTarget({ x_m: Number(x_m.toFixed(3)), y_m: Number(y_m.toFixed(3)), label: "Selected map point" });
    setDestination(""); setPickTarget(false); setPlannedRoute(null);
  };

  return <div className="page-grid map-page">
    <Panel className="map-canvas-panel"><SectionHeading kicker="EDITABLE FLOOR PLAN + LIVE ODOMETRY" title={draft?.name ?? "House map"} action={<div className="heading-actions"><button className="icon-button" onClick={() => void refresh()} disabled={!client || loading} title="Refresh map"><RefreshCw className={loading ? "spin" : ""} size={16} /></button><button className="secondary-button map-reset" onClick={() => void reset()} disabled={!client}><RotateCcw size={15} />Reset trail</button></div>} />
      <div className="floor-tools" aria-label="Floor-plan tools">
        <button onClick={() => add("rooms")} disabled={!draft}><Plus size={14} />Room</button>
        <button onClick={() => add("rooms", "bathroom")} disabled={!draft}><Plus size={14} />Bathroom</button>
        <button onClick={() => add("walls")} disabled={!draft}><VectorSquare size={14} />Wall</button>
        <button onClick={() => add("doors")} disabled={!draft}><DoorOpen size={14} />Door</button>
        <button onClick={() => add("objects", "sofa")} disabled={!draft}><Sofa size={14} />Sofa</button>
        <button onClick={() => add("objects", "bed")} disabled={!draft}><BedDouble size={14} />Bed</button>
        <select aria-label="Add another object" defaultValue="" onChange={(event) => { if (event.target.value) add("objects", event.target.value); event.target.value = ""; }} disabled={!draft}><option value="">+ Other object…</option>{objectTypes.filter((value) => value !== "sofa" && value !== "bed").map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select>
      </div>
      <div className="house-map-surface floor-plan-surface">
        {displayMap && projected && draft ? <svg viewBox="0 0 800 500" role="img" aria-label="Editable EKO floor plan" onClick={chooseMapPoint}>
          <defs><pattern id="meter-grid" width={projected.scale} height={projected.scale} patternUnits="userSpaceOnUse"><path d={`M ${projected.scale} 0 L 0 0 0 ${projected.scale}`} fill="none" stroke="#17364a" strokeWidth="1" /></pattern><clipPath id="floor-clip"><rect x={projected.left} y={projected.top} width={draft.width_m * projected.scale} height={draft.height_m * projected.scale} /></clipPath></defs>
          <rect x={projected.left} y={projected.top} width={draft.width_m * projected.scale} height={draft.height_m * projected.scale} fill="#06121b" stroke="#4a7892" strokeWidth="3" />
          <rect x={projected.left} y={projected.top} width={draft.width_m * projected.scale} height={draft.height_m * projected.scale} fill="url(#meter-grid)" opacity=".8" />
          {draft.rooms.map((room) => { const p = projectFloorPoint(projected, room.x_m, room.y_m + room.height_m); return <g key={room.id} className={`floor-item room-item ${selected("rooms", room.id) ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); setSelection({ kind: "rooms", id: room.id }); }}><rect x={p.x} y={p.y} width={room.width_m * projected.scale} height={room.height_m * projected.scale} rx="4" /><text x={p.x + room.width_m * projected.scale / 2} y={p.y + room.height_m * projected.scale / 2 - 4} textAnchor="middle">{room.name}</text><text className="floor-sub-label" x={p.x + room.width_m * projected.scale / 2} y={p.y + room.height_m * projected.scale / 2 + 11} textAnchor="middle">{room.type.replaceAll("_", " ")}</text></g>; })}
          {draft.walls.map((wall) => { const a = projectFloorPoint(projected, wall.x1_m, wall.y1_m); const b = projectFloorPoint(projected, wall.x2_m, wall.y2_m); return <line key={wall.id} className={`floor-item wall-item ${selected("walls", wall.id) ? "selected" : ""}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={Math.max(3, wall.thickness_m * projected.scale)} onClick={(event) => { event.stopPropagation(); setSelection({ kind: "walls", id: wall.id }); }} />; })}
          {draft.doors.map((door) => { const p = projectFloorPoint(projected, door.x_m, door.y_m); return <g key={door.id} className={`floor-item door-item ${selected("doors", door.id) ? "selected" : ""}`} transform={`translate(${p.x} ${p.y}) rotate(${-door.rotation_deg})`} onClick={(event) => { event.stopPropagation(); setSelection({ kind: "doors", id: door.id }); }}><line x1={-door.width_m * projected.scale / 2} y1="0" x2={door.width_m * projected.scale / 2} y2="0" /><path d={`M ${-door.width_m * projected.scale / 2} 0 A ${door.width_m * projected.scale} ${door.width_m * projected.scale} 0 0 1 ${door.width_m * projected.scale / 2} ${-door.width_m * projected.scale}`} /><text y="-7" textAnchor="middle">{door.label}</text></g>; })}
          {draft.objects.map((object) => { const p = projectFloorPoint(projected, object.x_m, object.y_m + object.height_m); const w = object.width_m * projected.scale; const h = object.height_m * projected.scale; return <g key={object.id} className={`floor-item object-item ${selected("objects", object.id) ? "selected" : ""}`} transform={`rotate(${-object.rotation_deg} ${p.x + w / 2} ${p.y + h / 2})`} onClick={(event) => { event.stopPropagation(); setSelection({ kind: "objects", id: object.id }); }}><rect x={p.x} y={p.y} width={w} height={h} rx="5" /><text x={p.x + w / 2} y={p.y + h / 2 + 4} textAnchor="middle">{object.label}</text></g>; })}
          <g clipPath="url(#floor-clip)">{polyline && <polyline points={polyline} fill="none" stroke="#4aa9ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}</g>
          <g clipPath="url(#floor-clip)">{obstacles.map((obstacle) => { const p = projectFloorPoint(projected, obstacle.x_m, obstacle.y_m); return <circle key={obstacle.id} className="memory-obstacle" cx={p.x} cy={p.y} r={Math.max(5, obstacle.radius_m * projected.scale)} opacity={Math.max(.25, obstacle.confidence)} />; })}{routePolyline && <polyline className="route-line" points={routePolyline} />}{routePoints.map((point, index) => <circle className="route-waypoint" key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r="5" />)}</g>
          <g transform={`translate(${projected.robot.x} ${projected.robot.y}) rotate(${projected.robot.yaw})`}><circle r="16" fill="#0f3147" stroke="#50e2cd" strokeWidth="3" /><path d="M 0 -20 L 7 -7 L -7 -7 Z" fill="#50e2cd" /><text y="5" textAnchor="middle" fill="#e8ffff" fontSize="8" fontWeight="700">EKO</text></g>
          <text x={projected.left} y={projected.top - 9} fill="#7094aa" fontSize="11">{draft.width_m.toFixed(2)} m × {draft.height_m.toFixed(2)} m · 1 m grid</text>
        </svg> : <EmptyState icon={LocateFixed} title="No map received" message="Connect to EKO to load the persistent layout and live odometry." />}
      </div>{error && <p className="inline-error">{error}</p>}
    </Panel>
    <div className="map-sidebar floor-editor-sidebar">
      <Panel className="navigation-panel"><SectionHeading kicker="AUTONOMOUS ROUTE" title="Send EKO" action={<RouteIcon size={19} />} /><div className="navigation-form"><label><span>Room or object</span><input list="map-destinations" value={destination} placeholder="Kitchen, sofa, bedroom…" onChange={(event) => { setDestination(event.target.value); setCoordinateTarget(null); setPlannedRoute(null); }} /></label><datalist id="map-destinations">{draft?.rooms.map((room) => <option key={room.id} value={room.name} />)}{draft?.objects.map((object) => <option key={object.id} value={object.label} />)}</datalist>{coordinateTarget && <p className="muted-copy">Point: {coordinateTarget.x_m.toFixed(2)}, {coordinateTarget.y_m.toFixed(2)} m</p>}<button className={`secondary-button ${pickTarget ? "active" : ""}`} onClick={() => setPickTarget((value) => !value)}><Crosshair size={15} />{pickTarget ? "Click the map…" : "Choose point on map"}</button><label className="navigation-return"><input type="checkbox" checked={returnToStart} onChange={(event) => setReturnToStart(event.target.checked)} /><span>Return to the starting point</span></label><div className="navigation-actions"><button className="secondary-button" disabled={!client || !target || navigationBusy} onClick={() => void navigationAction("plan")}><RouteIcon size={15} />Plan</button><button className="primary-button" disabled={!client || !target || navigationBusy} onClick={() => void navigationAction("go")}><Play size={15} />Go</button><button className="secondary-button" disabled={!client || navigationBusy} onClick={() => void navigationAction("stop")}><Octagon size={15} />Stop</button><button className="secondary-button" disabled={!client || navigationBusy} onClick={() => void navigationAction("relocalize")}><LocateFixed size={15} />Find me</button></div></div><dl className="detail-list"><div><dt>State</dt><dd>{map?.navigation?.state ?? "—"}</dd></div><div><dt>Route</dt><dd>{route ? `${route.distance_m.toFixed(2)} m · ${route.segments.length} segments` : "Not planned"}</dd></div><div><dt>Replans</dt><dd>{map?.navigation?.replans ?? 0}</dd></div><div><dt>Remembered obstacles</dt><dd>{obstacles.length}</dd></div></dl></Panel>
      <Panel><SectionHeading kicker="LAYOUT EDITOR" title="Exact dimensions" action={<VectorSquare size={19} />} />{draft ? <FloorPlanInspector plan={draft} selection={selection} updatePlan={updatePlan} updateSelected={updateSelected} removeSelected={removeSelected} /> : <p className="muted-copy">Connect to EKO to edit the plan.</p>}<div className="editor-save-row"><button className="secondary-button" disabled={!dirty || !map?.layout} onClick={() => { if (map?.layout) { setDraft(clone(map.layout)); setDirty(false); setSelection(null); } }}>Discard</button><button className="primary-button" disabled={!client || !draft || !dirty || saving} onClick={() => void save()}><Save size={15} />{saving ? "Saving…" : "Save layout"}</button></div></Panel>
      <Panel><SectionHeading kicker="CURRENT POSE" title="Position" action={<Compass size={19} />} /><dl className="detail-list"><div><dt>X translation</dt><dd>{meters(map?.pose.x_m)}</dd></div><div><dt>Y translation</dt><dd>{meters(map?.pose.y_m)}</dd></div><div><dt>MPU heading</dt><dd>{map ? `${map.pose.yaw_deg.toFixed(1)}°` : "—"}</dd></div><div><dt>Trail points</dt><dd>{map?.path.length ?? 0}</dd></div></dl></Panel>
      <Panel><SectionHeading kicker="SENSORS" title="Fusion status" action={<MousePointer2 size={19} />} /><dl className="detail-list"><div><dt>Optical mouse</dt><dd className={map?.status.connected ? "ready" : "disabled"}>{map?.status.connected ? map.status.device_name ?? "Connected" : map?.status.enabled ? "Waiting" : "Disabled"}</dd></div><div><dt>Nano yaw</dt><dd>{map?.status.last_yaw_at ? "Receiving" : "Waiting"}</dd></div><div><dt>Quality</dt><dd>Dead reckoning</dd></div></dl>{map?.status.last_error && <p className="inline-error">{map.status.last_error}</p>}</Panel>
      <div className="map-caution"><TriangleAlert size={19} /><p>The editable layout is persistent. The blue trail is relative dead reckoning and can drift; resetting the trail never deletes rooms, walls, doors, or furniture.</p></div>
    </div>
  </div>;
}
