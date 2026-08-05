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
  song_enabled: boolean;
  hardware_enabled: boolean;
  motors_enabled: boolean;
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
  capability_status?: {
    camera: CapabilityQuotaStatus;
    song: CapabilityQuotaStatus;
    sensors?: SensorHubStatus;
    terminal?: TerminalStatus;
    eyes?: EyesStatus;
    faces?: FaceStatus;
    person_follow?: FollowStatus;
    vision_runtime?: VisionRuntimeStatus;
    speaker?: SpeakerStatus;
    spotify?: SpotifyStatus;
    odometry?: OdometryStatus;
    sound_direction?: SoundDirectionStatus;
    workflows?: WorkflowStatus;
    motors?: MotorRuntimeStatus;
    physical_voice?: PhysicalVoiceStatus;
  };
  settings: RuntimeSettings;
  ai: AIStatus;
}

export interface CapabilityQuotaStatus {
  configured: boolean;
  enabled: boolean;
  available: boolean;
  limit: number;
  remaining: number;
  window_seconds: number;
  retry_after_seconds: number;
}

export interface SensorHubStatus {
  enabled: boolean;
  connected: boolean;
  verified: boolean;
  port_open: boolean;
  port: string | null;
  moving_scan: boolean;
  distance_threshold_cm: number;
  last_seen: number | null;
  last_payload: Record<string, number> | null;
  last_error: string | null;
  emergency_stops: number;
  thread_alive: boolean;
  protocol?: number | null;
  distances_cm?: Record<string, number>;
  yaw_degrees?: number | null;
  yaw_axis?: string | null;
  mpu_ok?: boolean;
  telemetry_count?: number;
}

export interface TerminalStatus {
  enabled: boolean;
  active_sessions: number;
  max_sessions: number;
  idle_timeout_seconds: number;
  requires_tailscale_identity: boolean;
}

export interface EyeState {
  expression: string;
  gaze_x: number;
  gaze_y: number;
  blink: boolean;
  source: string;
  updated_at: number;
  revision: number;
}

export interface EyesStatus {
  ok?: boolean;
  enabled: boolean;
  connected: boolean;
  width: number;
  height: number;
  state: EyeState;
  displayed_at?: number | null;
  desired_revision?: number;
  last_error: string | null;
  transport_errors?: number;
  thread_alive?: boolean;
}

export interface FaceRecord {
  face_id: string;
  user_id: string;
  name: string;
  sample_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ActiveFace {
  face_id: string;
  user_id: string;
  name: string;
  confidence: number;
  box: number[];
}

export interface FaceStatus {
  enabled: boolean;
  enrolled: number;
  active: ActiveFace | null;
  recognition_threshold: number;
  security_identity: boolean;
}

export interface FacesPayload {
  ok: boolean;
  faces: FaceRecord[];
  active: ActiveFace | null;
  status: FaceStatus;
}

export interface FollowStatus {
  ok?: boolean;
  enabled: boolean;
  available?: boolean;
  active: boolean;
  started_at: number | null;
  last_target_at: number | null;
  last_error: string | null;
}

export interface VisionRuntimeStatus {
  enabled: boolean;
  running: boolean;
  frame_sequence: number;
  following_requested: boolean;
  person_target: Record<string, unknown> | null;
  last_error: string | null;
}

export interface SpeakerStatus {
  enabled: boolean;
  tts_configured: boolean;
  output_device: string;
  last_error: string | null;
  busy?: boolean;
  last_playback_at?: number | null;
  last_played_file?: string | null;
}

export interface PhysicalVoiceStatus {
  running: boolean;
  error: string | null;
  phase?: "stopped" | "starting" | "wakeword" | "acknowledging" | "recording" | "transcribing" | "disabled" | "retrying";
  wakeword_enabled?: boolean;
  autostart?: boolean;
  channels: number;
  stt_engine: string;
}

export interface WorkflowRecord {
  correlation_id: string;
  source: string;
  category: string;
  started_at: number;
  completed_at: number | null;
  duration_ms: number | null;
  ok: boolean | null;
  error_code: string | null;
  outputs: Record<string, string>;
}

export interface WorkflowStatus {
  active: WorkflowRecord[];
  recent: WorkflowRecord[];
}

export interface MotorRuntimeStatus {
  running: boolean;
  last_execution: Record<string, unknown> | null;
}

export interface SpotifyStatus {
  enabled: boolean;
  configured: boolean;
  device_id_set: boolean;
  device_name: string;
  last_error: string | null;
}

export interface SoundDirectionStatus {
  enabled: boolean;
  last_estimate: { angle_degrees: number; side: string; confidence: number } | null;
  last_error: string | null;
  channels: { left: number; right: number };
}

export interface OdometryStatus {
  enabled: boolean;
  connected: boolean;
  thread_alive: boolean;
  device_path: string | null;
  device_name: string | null;
  pose: MapPose;
  raw_counts: { x: number; y: number };
  path_points: number;
  last_motion_at: number | null;
  last_yaw_at: number | null;
  last_error: string | null;
}

export interface MapPose { x_m: number; y_m: number; yaw_deg: number; }
export interface MapPoint extends MapPose { timestamp: number; }
export type FloorRoomType = "room" | "bedroom" | "living_room" | "kitchen" | "bathroom" | "dining_room" | "hallway" | "balcony" | "utility" | "office" | "garage" | "other";
export type FloorObjectType = "sofa" | "bed" | "table" | "chair" | "wardrobe" | "cabinet" | "toilet" | "sink" | "bathtub" | "shower" | "appliance" | "desk" | "shelf" | "plant" | "custom";
export interface FloorRoom { id: string; name: string; type: FloorRoomType; x_m: number; y_m: number; width_m: number; height_m: number; }
export interface FloorWall { id: string; x1_m: number; y1_m: number; x2_m: number; y2_m: number; thickness_m: number; }
export interface FloorDoor { id: string; label: string; x_m: number; y_m: number; width_m: number; rotation_deg: number; }
export interface FloorObject { id: string; type: FloorObjectType; label: string; x_m: number; y_m: number; width_m: number; height_m: number; rotation_deg: number; }
export interface FloorPlan {
  version: 1;
  name: string;
  width_m: number;
  height_m: number;
  rooms: FloorRoom[];
  walls: FloorWall[];
  doors: FloorDoor[];
  objects: FloorObject[];
  updated_at: number | null;
}
export interface MapPayload {
  ok: boolean;
  status: OdometryStatus;
  pose: MapPose;
  path: MapPoint[];
  bounds: { min_x_m: number; max_x_m: number; min_y_m: number; max_y_m: number };
  units: "meters";
  quality: "dead_reckoning";
  layout: FloorPlan | null;
  layout_status: { persist_file: string; last_error: string | null; rooms: number; walls: number; doors: number; objects: number } | null;
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

export interface DebugLogEntry {
  sequence: number;
  timestamp: string;
  level: string;
  logger: string;
  thread: string;
  message: string;
  exception: string | null;
}

export interface DebugLogsPayload {
  logs: DebugLogEntry[];
  latest_sequence: number;
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
export interface TelemetryMessage { type: "telemetry"; sent_at: number; status: StatusPayload; events: EkoEvent[]; logs?: DebugLogEntry[]; }

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

export interface ConfigBatchPayload {
  ok: boolean;
  valid: boolean;
  dry_run: boolean;
  changed_paths: string[];
  restart_required: boolean;
  restart_files: string[];
  warnings: string[];
  backup_names: Record<string, string>;
  applied_live: boolean;
  files?: ConfigFile[];
  restart_command: string | null;
}

export interface WifiRecoveryProfile {
  id: string;
  ssid: string;
  priority: number;
  password_set: boolean;
}

export interface WifiRecoveryProfileDraft extends WifiRecoveryProfile {
  password?: string;
  clear_password?: boolean;
}

export interface WifiProfilesPayload {
  ok?: boolean;
  profiles: WifiRecoveryProfile[];
  max_profiles: number;
  applies?: string;
}

export type EkoOperation =
  | "health" | "events" | "memories" | "memory.remember" | "memory.forget"
  | "chat.history" | "chat.forget"
  | "message" | "command" | "drive" | "control" | "settings.get"
  | "settings.update" | "ai" | "vision.snapshot"
  | "eyes.get" | "eyes.expression"
  | "faces.list" | "faces.enroll" | "faces.delete"
  | "follow.get" | "follow.start" | "follow.stop"
  | "map.get" | "map.reset" | "map.layout.update"
  | "config.list" | "config.update" | "config.batch"
  | "wifi.profiles" | "wifi.profiles.update"
  | "debug.logs" | "terminal.status";

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
