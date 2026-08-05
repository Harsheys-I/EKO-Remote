# EKO Remote v1.3.0

EKO Remote is the static GitHub Pages control surface for the physical Raspberry Pi robot. It
connects through private Tailscale HTTPS/WSS or the included BLE bridge. No robot token or cloud
credential is compiled into the site.

## v1.3 highlights

- The right rail previews the last round-eyeball frame committed to both physical OLEDs. Distinct
  visual symbols identify listening, thinking, speaking, movement focus, camera, success, surprise,
  error, anger, and sleep.
- **House Map** is now a complete persistent layout editor. Set arbitrary plan width/height and
  name; add named/typed rooms or bathrooms; add walls and doors; add sofas, beds, tables, chairs,
  wardrobes, cabinets, toilets, sinks, tubs, showers, appliances, desks, shelves, plants, and
  custom objects; select any item to edit exact meter coordinates, dimensions, thickness, or
  rotation; then atomically save or discard.
- The live blue optical-mouse/MPU trail is overlaid on the layout. **Reset trail** resets odometry
  only and never deletes the floor plan.
- The AI page keeps every answer visible. **EKO voice replies** independently controls whether
  EKO also speaks it through ElevenLabs.
- The top-bar **Debug mode** replaces the eye rail with live structured Pi logs on every page.
  Mock Mode remains removed.

The Drive page still reads a controller automatically through the Gamepad API (axes 0/1 and
buttons 4/5). EKO v1.3 deliberately keeps the uninstalled TB6612FNG outputs locked.

## Run locally

```bash
npm ci
npm test
npm run dev
```

Open `http://localhost:5174`.

## Publish to GitHub Pages

Overlay this archive on the existing Remote Git repository without deleting its `.git` folder:

```bash
rsync -a --delete \
  --exclude .git \
  --exclude node_modules \
  --exclude dist \
  /path/to/EKO-Remote_v1.3.0/ /path/to/your/EKO-Remote/

cd /path/to/your/EKO-Remote
npm ci
npm test
npm run build
git add -A
git commit -m "Release EKO Remote v1.3.0"
git push
```

Use GitHub Actions as the Pages source and hard-refresh after deployment. See
[Publish v1.3.0](docs/PUBLISH_1.3.0.md).

## Connect

On the Pi:

```bash
cd /home/pi/EKO
sudo ./deploy/setup_tailscale_https.sh
tailscale serve status
```

Enter the HTTPS address without `:8765`, for example:

```text
https://eko.example-tailnet.ts.net
```

Enter the current `EKO_API_TOKEN` separately. The browser must be signed into the same Tailscale
network. Keep the Pi API on loopback behind Tailscale Serve.

## BLE

The bridge supports floor-plan reads and atomic layout updates in addition to health, events,
debug logs, AI, configuration, vision, eyes, faces, following, odometry, and emergency stop.
Large layouts are chunked by the existing BLE framing protocol. Terminal access remains Wi-Fi/WSS
only.

## Security

- Use distinct random API and BLE tokens.
- Rotate credentials previously pasted into chat or logs.
- Saved Wi-Fi passwords remain write-only and Pi-local.
- Review exported debug logs before sharing them.
- The release contains no `.env`, credentials, browser storage, generated build, or dependency
  directory.

See [Architecture](docs/ARCHITECTURE.md), [BLE protocol](docs/BLE_PROTOCOL.md), and
[GitHub Pages HTTPS](docs/GITHUB_PAGES_HTTPS.md).
