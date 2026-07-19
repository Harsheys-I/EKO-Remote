# Changelog

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
