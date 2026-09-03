# EKO Remote v1.4.0

EKO Remote v1.4 is the HTTPS/BLE control surface for autonomous EKO navigation, exact camera
evidence, live calibration, and structured debugging.

## v1.4 highlights

- House Map can select a named room/object or click exact coordinates, preview the A* route, start
  navigation, request a return trip, stop immediately, or launch **Find me**.
- The map overlays the active smoothed route, waypoints, daily odometry trail, and remembered
  uncertain obstacles.
- Normal CAMERA answers show the exact one-frame JPEG sent to Groq, with size and SHA-256 prefix.
- Config exposes live navigation, geometry, side-obstacle, bottom-floor/drop, lift, sensor-position,
  relocalization, memory, and stereo-direction fields.
- Logs are grouped into Safety, Motion, AI, Hardware, and System; repeated telemetry is collapsed,
  rows are searchable/expandable, and the filtered view can be paused, cleared, or exported.
- Terminal uses a stable dedicated xterm DOM host, so opening/closing the PTY no longer blanks or
  freezes the page.
- Debug Mode remains available in the right dock on every page; Mock Mode is not present.

The red global STOP control remains transport-level and does not wait for the AI workflow.

## Publish

Overlay this archive onto the existing Remote Git repository:

```bash
rsync -a --delete \
  --exclude=.git/ \
  --exclude=node_modules/ \
  --exclude=dist/ \
  /path/to/EKO-Remote_v1.4.0/ /path/to/your/EKO-Remote/
cd /path/to/your/EKO-Remote
npm ci
npm test
npm run build
git add -A
git commit -m "Release EKO Remote v1.4.0"
git push
```

Keep the connection URL as the Tailscale HTTPS origin, for example:

```text
https://eko.tailbedebe.ts.net
```

Do not add `:8765` and do not use LAN HTTP from GitHub Pages. See
[Publish v1.4.0](docs/PUBLISH_1.4.0.md).
