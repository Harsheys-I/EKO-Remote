# EKO Remote v1.0.0 release manifest

Release date: 2026-07-23

## Included

- Physical-only Raspberry Pi control UI
- Persistent top-bar Debug Mode switch
- Right-side structured live-log stream with sequence deduplication
- Log level filter, pause/resume, clear, connection state, and active workflows
- Two live 128x64 eye previews when Debug Mode is off
- Physical camera, face identity, eye gaze, person detection, and map views
- Explicit missing-motor-driver lock across Dashboard, Drive, Settings, and Vision follow controls
- Automatic Gamepad API discovery with axes 0/1 and buttons 4/5
- Wi-Fi HTTPS/WSS and BLE structured-log transport
- Typed atomic configuration, Wi-Fi recovery profiles, and optional terminal
- GitHub Pages test/build/deploy workflow

## Release gates

- 18 Vitest behavior and transport tests
- 5 Python BLE bridge and API mapping tests
- Strict TypeScript project build
- Vite production build
- Responsive desktop, tablet, and mobile breakpoint/overflow source audit
- Clean archive extraction and secret scan

## Excluded

The release archive excludes `.env`, credentials, `node_modules`, `dist`, coverage, browser storage,
and generated caches. Physical Pi hardware and network acceptance must be completed after upload.
