# EKO Remote v1.3.0 release manifest

Release date: 2026-08-05

## Included

- Robot-authoritative synchronized round-eyeball previews
- Distinct listening/thinking/speaking/movement/camera/happy/surprised/error/angry/sleep symbols
- Persistent floor-plan editor with arbitrary dimensions
- Named and typed rooms, including bathroom and other room types
- Walls with endpoints/thickness and doors with position/width/rotation
- Sofa, bed, table, chair, storage, bathroom fixture, appliance, plant, and custom objects
- Exact metric inspector, canvas selection, deletion, atomic save, and discard
- Live odometry trail/pose overlay and layout-preserving reset
- HTTPS/WSS and BLE `map.layout.update`
- Existing Debug Mode, AI voice-reply control, physical vision, memory, config, terminal, and Gamepad UI

## Release gates

- 22 Vitest behavior/transport checks
- Strict TypeScript project build
- Vite production build
- 5 Python BLE bridge route/protocol checks
- Responsive desktop/tablet/mobile source audit
- Clean archive and secret scan

## Excluded

`.env`, credentials, `node_modules`, `dist`, coverage, browser storage, and generated caches.
