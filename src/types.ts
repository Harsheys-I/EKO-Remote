export type RobotMode = "booting" | "idle" | "listening" | "thinking" | "speaking" | "error" | "shutting_down" | "offline";
export type ControlMode = "manual" | "assist" | "stationary";
export type TransportKind = "wifi" | "ble";

export interface HealthMetrics {
  battery_percent: number | null;
  cpu_temperature_c: number | null;
  cpu_usage_percent: number | null;
  memory_usage_percent: number | null;
  storage_used_bytes: number | null;
  storage_total_bytes: number | null;
  storage_usage_percent: number | null;
  storage_last_updated: string | null;
  last_updated: string;
}

export interface RobotState {
  mode: RobotMode;
  listening: boolean;
  thinking: boolean;
  speaking: boolean;
  moving: boolean;
  started_at: string | null;
  last_error: string | null;
  health: HealthMetrics;
}

export interface RuntimeSettings {
  control_mode: ControlMode;
  speed_limit: number;
  voice_responses: boolean;
  wakeword_enabled: boolean;
  memory_auto_inject: boolean;
  web_search_enabled: boolean;
  camera_on_demand: boolean;
  hardware_enabled: boolean;
  vision_enabled: boolean;
  audio_enabled: boolean;
  requires_restart: string[];
}

export interface AIStatus {
  provider: string;
  model: string;
  context_messages?: number;
  context_enabled?: boolean;
  temporary_chat?: TemporaryChatStatus;
}

export interface TemporaryChatStatus {
  enabled: boolean;
  exact_limit: number;
  exact_exchanges: number;
  summary_words: number;
  summary_present: boolean;
  total_exchanges: number;
  persistent: boolean;
  cleared?: boolean;
}

export interface StatusPayload {
  ok: boolean;
  robot: { name: string; version: string };
  state: RobotState;
  capabilities: Record<string, boolean>;
  settings: RuntimeSettings;
  ai: AIStatus;
}

export interface ServiceResult<T = unknown> {
  ok: boolean;
  value: T;
  response: string | null;
  error_code: string | null;
  metadata: Record<string, unknown>;
}

export interface EkoEvent {
  name: string;
  payload: Record<string, unknown>;
  timestamp: string;
  correlation_id: string | null;
}

export interface MemoryRecord {
  id: number;
  display_index: number;
  kind: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface DriveVector { vx: number; vy: number; wz: number; }
export interface MotionCommand { command: string; payload: Record<string, unknown>; monotonic_time: number; }
export interface ControlStatus { settings: RuntimeSettings; recent_commands: MotionCommand[]; }
export interface VisionSnapshot { ok: boolean; captured_at: number; mime_type: string; image_base64: string; }
export interface TelemetryMessage { type: "telemetry"; sent_at: number; status: StatusPayload; events: EkoEvent[]; }

export type ConfigFieldType = "boolean" | "integer" | "number" | "string" | "array";

export interface ConfigField {
  path: string;
  label: string;
  group: string;
  type: ConfigFieldType;
  value: unknown;
  nullable: boolean;
  read_only: boolean;
  environment_name: string | null;
  restart_required: boolean;
  options: Array<string | number>;
  minimum: number | null;
  maximum: number | null;
}

export interface ConfigFile {
  name: string;
  title: string;
  description: string;
  fields: ConfigField[];
  restart_required: boolean;
  modified_at: string;
}

export interface ConfigListPayload {
  files: ConfigFile[];
  restart_command: string;
}

export interface ConfigSavePayload {
  ok: boolean;
  file: ConfigFile & { applied_live: boolean; backup_name: string; changed_paths: string[] };
  restart_command: string | null;
}

export type EkoOperation =
  | "health" | "events" | "memories" | "memory.remember" | "memory.forget"
  | "chat.history" | "chat.forget"
  | "message" | "command" | "drive" | "control" | "settings.get"
  | "settings.update" | "ai" | "vision.snapshot"
  | "config.list" | "config.update";

export interface ConnectionProfile {
  kind: TransportKind;
  wifiUrl: string;
  wifiToken: string;
  bleToken: string;
  bleDeviceId: string;
  autoReconnect: boolean;
}

export interface LinkStats {
  connected: boolean;
  connecting: boolean;
  kind: TransportKind | null;
  label: string;
  latencyMs: number | null;
  lastUpdated: Date | null;
  error: string | null;
}

export const offlineState: RobotState = {
  mode: "offline", listening: false, thinking: false, speaking: false, moving: false,
  started_at: null, last_error: null,
  health: {
    battery_percent: null,
    cpu_temperature_c: null,
    cpu_usage_percent: null,
    memory_usage_percent: null,
    storage_used_bytes: null,
    storage_total_bytes: null,
    storage_usage_percent: null,
    storage_last_updated: null,
    last_updated: new Date(0).toISOString(),
  },
};
