import type { ConfigListPayload, ConfigSavePayload, ControlStatus, DriveVector, EkoEvent, MemoryRecord, RuntimeSettings, ServiceResult, StatusPayload, VisionSnapshot } from "./types";

export class EkoClient {
  constructor(readonly transport: import("./transports/Transport").EkoTransport) {}
  health() { return this.transport.request<StatusPayload>("health"); }
  events(limit = 100) { return this.transport.request<{ events: EkoEvent[] }>("events", { limit }); }
  memories(query = "", limit = 50) { return this.transport.request<{ memories: MemoryRecord[] }>("memories", { query, limit }); }
  remember(content: string, tags: string[] = []) { return this.transport.request<ServiceResult>("memory.remember", { content, tags }); }
  forget(id: number) { return this.transport.request<ServiceResult>("memory.forget", { id }); }
  message(text: string) { return this.transport.request<ServiceResult>("message", { text }); }
  command(command: string) { return this.transport.request<ServiceResult>("command", { command }); }
  drive(vector: DriveVector, waitForReply = false) { return waitForReply ? this.transport.request<ServiceResult>("drive", vector as unknown as Record<string, unknown>) : this.transport.send("drive", vector as unknown as Record<string, unknown>); }
  control() { return this.transport.request<ControlStatus>("control"); }
  settings() { return this.transport.request<RuntimeSettings>("settings.get"); }
  updateSettings(changes: Partial<RuntimeSettings>) { return this.transport.request<RuntimeSettings>("settings.update", changes as Record<string, unknown>); }
  ai() { return this.transport.request<StatusPayload["ai"]>("ai"); }
  snapshot() { return this.transport.request<VisionSnapshot>("vision.snapshot"); }
  configFiles() { return this.transport.request<ConfigListPayload>("config.list"); }
  updateConfig(name: string, values: Record<string, unknown>) { return this.transport.request<ConfigSavePayload>("config.update", { name, values }); }
  stop() { return this.transport.emergencyStop(); }
}
