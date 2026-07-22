# EKO Remote v0.4.1 release manifest

Release date: 2026-07-20

Verified release gates:

- 12 Vitest semantic-client, BLE framing, and gamepad-mapping checks
- 4 Python BLE bridge/API mapping checks
- strict TypeScript project build
- Vite production build for a GitHub Pages project path
- no `.env`, API key, API token, `node_modules`, or generated `dist` in the release archive

The source includes a global Mock hardware switch, lazy one-frame browser camera capture,
continuous optional browser microphone PCM, Pi-side speaker playback, an automatically detected
Gamepad, the Pi-accepted Mecanum twin, cross-file staged configuration, structured Wi-Fi profiles, the
authenticated PTY page, GitHub Pages Actions deployment, BLE fallback bridge, architecture and
publishing references, and transport tests.

Browser microphone/camera/Gamepad behavior was type-checked and exercised through the simulated Pi
protocol, but no physical browser device, gamepad, Raspberry Pi, or Tailscale tailnet was available
inside the release environment. Those device-permission and end-to-end network checks remain part
of deployment acceptance.
