# Changelog

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
