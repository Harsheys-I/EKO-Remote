import type { ConfigBatchPayload, ConfigListPayload, ConfigSavePayload, ControlStatus, DebugLogsPayload, DriveVector, EkoEvent, EyesStatus, FacesPayload, FloorPlan, FollowStatus, MapPayload, MemoryRecord, RuntimeSettings, ServiceResult, StatusPayload, TemporaryChatStatus, TerminalStatus, VisionSnapshot, WifiProfilesPayload, WifiRecoveryProfileDraft } from "./types";

export class EkoClient {
  constructor(readonly transport: import("./transports/Transport").EkoTransport) {}
  health() { return this.transport.request<StatusPayload>("health"); }
  events(limit = 100) { return this.transport.request<{ events: EkoEvent[] }>("events", { limit }); }
  memories(query = "", limit = 50) { return this.transport.request<{ memories: MemoryRecord[] }>("memories", { query, limit }); }
  remember(content: string, tags: string[] = []) { return this.transport.request<ServiceResult>("memory.remember", { content, tags }); }
  forget(id: number) { return this.transport.request<ServiceResult>("memory.forget", { id }); }
  chatHistory() { return this.transport.request<TemporaryChatStatus>("chat.history"); }
  forgetChatHistory() { return this.transport.request<TemporaryChatStatus>("chat.forget"); }
  message(text: string) { return this.transport.request<ServiceResult>("message", { text }); }
  command(command: string) { return this.transport.request<ServiceResult>("command", { command }); }
  drive(vector: DriveVector, waitForReply = false) { return waitForReply ? this.transport.request<ServiceResult>("drive", vector as unknown as Record<string, unknown>) : this.transport.send("drive", vector as unknown as Record<string, unknown>); }
  control() { return this.transport.request<ControlStatus>("control"); }
  settings() { return this.transport.request<RuntimeSettings>("settings.get"); }
  updateSettings(changes: Partial<RuntimeSettings>) { return this.transport.request<RuntimeSettings>("settings.update", changes as Record<string, unknown>); }
  ai() { return this.transport.request<StatusPayload["ai"]>("ai"); }
  snapshot() { return this.transport.request<VisionSnapshot>("vision.snapshot"); }
  eyes() { return this.transport.request<EyesStatus>("eyes.get"); }
  setEyeExpression(expression: string, holdSeconds = 2) { return this.transport.request<EyesStatus>("eyes.expression", { expression, hold_seconds: holdSeconds }); }
  faces() { return this.transport.request<FacesPayload>("faces.list"); }
  enrollFace(name: string) { return this.transport.request<{ ok: boolean; face: FacesPayload["faces"][number] }>("faces.enroll", { name }); }
  deleteFace(faceId: string) { return this.transport.request<{ ok: boolean; face_id: string }>("faces.delete", { face_id: faceId }); }
  followStatus() { return this.transport.request<FollowStatus>("follow.get"); }
  startFollowing() { return this.transport.request<ServiceResult>("follow.start"); }
  stopFollowing() { return this.transport.request<ServiceResult>("follow.stop"); }
  map() { return this.transport.request<MapPayload>("map.get"); }
  resetMap() { return this.transport.request<MapPayload>("map.reset"); }
  saveFloorPlan(layout: FloorPlan) { return this.transport.request<{ ok: boolean; layout: FloorPlan; map: MapPayload }>("map.layout.update", { layout }); }
  configFiles() { return this.transport.request<ConfigListPayload>("config.list"); }
  updateConfig(name: string, values: Record<string, unknown>) { return this.transport.request<ConfigSavePayload>("config.update", { name, values }); }
  validateConfigBatch(changes: Record<string, Record<string, unknown>>) { return this.transport.request<ConfigBatchPayload>("config.batch", { changes, dry_run: true }); }
  applyConfigBatch(changes: Record<string, Record<string, unknown>>) { return this.transport.request<ConfigBatchPayload>("config.batch", { changes, dry_run: false }); }
  wifiProfiles() { return this.transport.request<WifiProfilesPayload>("wifi.profiles"); }
  updateWifiProfiles(profiles: WifiRecoveryProfileDraft[]) { return this.transport.request<WifiProfilesPayload>("wifi.profiles.update", { profiles }); }
  debugLogs(limit = 300, after = 0) { return this.transport.request<DebugLogsPayload>("debug.logs", { limit, after }); }
  terminalStatus() { return this.transport.request<TerminalStatus>("terminal.status"); }
  stop() { return this.transport.emergencyStop(); }
}
