# Changelog

## 1.4.0

- Added autonomous destination, point-picking, return-trip, route preview, Go, STOP, obstacle-clear, and Find Me client operations over Wi-Fi and BLE.
- Added active route, waypoint, and confidence-weighted obstacle overlays to the editable House Map.
- Added exact one-frame Groq CAMERA evidence inside AI chat, including evidence retained when analysis fails after capture.
- Rebuilt Logs around Safety/Motion/AI/Hardware/System groups, severity, summaries, expandable payloads, telemetry collapsing, search, pause, clear, and export.
- Repaired the PTY page with a dedicated terminal host that React never replaces while xterm owns it.
- Added the alert eye state and v1.4 navigation/relocalization/status types.
- Kept Debug Mode and global STOP; Mock Mode remains removed.

## 1.3.0

- Rebuilt every eye expression around a simple round eyeball with distinct operational adornments matching the physical renderer.
- Added a persistent custom-dimension floor-plan editor with named/typed rooms, bathrooms, walls, doors, furniture, fixtures, precise measurements, selection, deletion, save, and discard.
- Overlaid live optical-mouse/MPU pose and trail on the fixed layout coordinate system.
- Added typed `/map/layout` Wi-Fi and BLE operations while keeping trail reset independent from layout data.
- Added the `acknowledging` physical-voice phase and preserved committed-frame eye synchronization, Debug Mode, visible/spoken answer control, automatic Gamepad discovery, and motor lock.

## 1.2.0

- Removed the independent browser blink clock from Live Eyes.
- Rendered only the robot's last successfully committed dual-OLED state, so Remote cannot run ahead of the physical face.
- Consumed Wi-Fi eye telemetry at the OLED frame cadence instead of the previous 750 ms backend interval.
- Preserved Debug Mode, the visible-plus-spoken AI answer switch, physical controls, and the motor-driver lock.

## 1.1.0

- Added an AI-page **EKO voice replies** switch backed by the robot's live `voice_responses` setting.
- Kept every AI answer visible in the website while allowing ElevenLabs speech to be independently enabled or disabled.
- Displayed the physical voice supervisor phase and wake-listener status.
- Extended eye health types for reconnecting OLED transport telemetry.
- Preserved the physical-only Debug Mode interface and motor-driver lock.

## 1.0.0

- Removed browser Mock Mode, its media bridge, mock sensor injection, and all mock UI controls.
- Added a persistent top-bar Debug Mode switch and a right-side live structured Pi log stream.
- Added sequence-based log catch-up and deduplication over HTTPS/WSS and BLE.
- Added level filtering, pause/resume, clear, connection state, and concurrent workflow state to the debug rail.
- Kept the dual 128x64 eye rail as the normal view when Debug Mode is off.
- Made Vision physical-camera-only and kept person-follow movement unavailable until motor drivers exist.
- Made Dashboard, Drive, and Settings reflect the independent motor-driver lock.
- Preserved automatic Gamepad API discovery and all robot-side safety behavior.

## 0.5.0

- Added a sticky right-side EKO face rail with two separately rendered 128×64 eye screens driven by the same expression, gaze, blink, source, active-face, OLED-link, and sound-angle state as the Pi.
- Expanded Vision with local face enrollment/list/delete, active identity, explicit cloud snapshot policy, OpenCV runtime telemetry, and safety-bounded follow start/stop controls.
- Added House Map with a live meter-scaled optical-mouse trail, MPU heading marker, device/fusion status, dead-reckoning warning, polling, and confirmed reset.
- Added typed Wi-Fi and BLE operations for eyes, faces, following, and map data, including long-request handling for enrollment and bridge routing tests.
- Preserved the global Mock hardware switch, user-gesture one-shot browser camera, automatic gamepad discovery, and every v0.4.2 safety behavior.

## 0.4.2

- Prepared the browser camera directly from the Vision capture button's user gesture before asking the Pi for its matching frame, fixing delayed permission and media-playback failures on stricter desktop and mobile browsers.
- Kept AI CAMERA requests lazy while centralizing stream startup, bounded JPEG generation, session checks, timeout cleanup, and track shutdown in a tested one-shot camera adapter.
- Ensured success, permission denial, frame failure, HTTP failure, timeout, Mock-mode disable, and component cleanup all stop the camera without closing the Mock hardware WebSocket.
- Added four browser-camera lifecycle simulations and raised the verified Remote test count to 16.

## 0.4.1

- Moved the Mock hardware master switch into the global top bar so it is available on every page.
- Changed browser camera handling to acquire one video-only stream per Pi request, capture one bounded JPEG, and always stop every camera track immediately afterward.
- Isolated camera permission/capture failures from the hardware WebSocket so CAMERA errors no longer disable Mock hardware.
- Fixed the browser-hardware handshake race by installing message handlers before sending `hello` and waiting for `session.ready`.
- Changed microphone startup failure into a per-device warning so camera, speaker, gamepad, and the drivetrain twin remain usable.
- Removed the artificial gamepad activation/pairing gate; Drive now discovers already-connected controllers automatically and preserves axes 0/1 plus L1/R1 button 4/5 behavior.
- Added gamepad mapping regressions and raised the verified browser test count to 12.

## 0.4.0

- Added a Dashboard Mock Mode master switch that explicitly requests browser microphone/camera access and opens a dedicated authenticated WSS hardware channel.
- Added live browser PCM, requested JPEG capture, Pi-generated speaker playback, device readiness, disconnect safety, and local camera preview while all processing stays on the Pi.
- Added an explicit Gamepad activation flow, simultaneous holonomic translation/rotation, Pi-accepted wheel telemetry, a bounded top-down robot twin, and mock obstacle injection.
- Replaced per-file saves with persistent cross-file staging and one validate-then-atomic-apply action, including warnings, backups, rollback errors, and one restart dialog.
- Added a disabled-by-default xterm.js PTY page over API-token, exact-Origin, and Tailscale-identity protected WSS; it is intentionally a fresh service-user shell rather than an HDMI mirror.
- Code-split the xterm.js terminal so the normal mission-control bundle stays below the build warning threshold and terminal code loads only when opened.
- Added Nano sensor readiness types and Wi-Fi/BLE semantic mappings for configuration batches, mock status/sensors, and terminal status.
- Verified 9 Vitest checks, 4 Python bridge checks, and a strict TypeScript/Vite production build.

## 0.3.4

- Added live Web search, Camera questions, and Song listening gates to the AI sidebar.
- Added robot-reported request quotas, remaining capacity, and cooldown status for camera and song operations.
- Added a structured fallback-network editor with SSID, write-only password replacement/clear, priority, add, and remove controls.
- Added Wi-Fi and BLE operation mappings for fallback profile reads and updates.
- Extended AI request timeouts for camera capture, song recording, transcription, search, and personality passes.
- Updated versioning, architecture, security guidance, and a fresh-clone GitHub publishing workflow.

## 0.3.3

- Added temporary CHAT telemetry and a Forget history button that clears only RAM context.
- Added Wi-Fi and BLE mappings for temporary-history status and reset operations.
- Changed Memory to dynamic 1…N display indexes and reloads after deletion.
- Removed redundant YAML/runtime toggle switchboards from Settings; typed controls remain in Config.
- Updated AI copy and status from “stateless” to the bounded five-exchange plus summary model.

## 0.3.2

- Replaced the raw YAML editor with generated controls for EKO's fixed typed configuration schema.
- Added every YAML boolean to the Settings feature switchboard with live/restart status.
- Displayed the AI channel as stateless instead of an increasing message-context counter.
- Updated the Wi-Fi path for private trusted HTTPS/WSS through Tailscale Serve.
- Updated Wi-Fi and BLE config operations from `config.save` to value-only `config.update`.
- Kept storage telemetry on the existing one-minute Pi sample.

## 0.3.1

- Added Pi storage used/total telemetry.
- Added authenticated configuration access and restart guidance.
- Added GitHub Pages deployment, Wi-Fi/WSS, Web Bluetooth, and the BLE bridge.
