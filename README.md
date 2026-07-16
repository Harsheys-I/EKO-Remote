# EKO Remote

EKO Remote is a standalone, static mission-control website for the EKO robot. Host it on GitHub Pages and connect to EKO over either:

- **Wi-Fi:** HTTPS requests plus WSS telemetry. This is the fastest link and the recommended path for camera images.
- **Bluetooth Low Energy:** direct browser-to-Raspberry Pi GATT connection through the included companion bridge. Every API operation is supported with chunked messages; large camera frames are slower.

The website contains no robot credentials at build time. Connection addresses and optional tokens are entered in the browser.

## Control surface

| Area | Capabilities |
| --- | --- |
| Dashboard | Robot mode, Pi health, battery, module readiness, behavior, events, and link health |
| Drive | Touch joystick, WASD/arrows, strafe, rotation, speed limit, manual/assist/stationary modes, acknowledgements, emergency stop |
| AI & Voice | Full conversation router, provider status, voice/wake-word/search/memory controls |
| Vision | Explicit one-frame camera capture with privacy state |
| Memory | Search, create, and delete SQLite memories |
| Logs | Live events, filtering, pause, and JSON export |
| Settings | Connection switching, credential removal, runtime preferences, and device status |

Motion remains protected by EKO's Raspberry Pi-side safety gate and 750 ms dead-man watchdog. Closing the page, losing Wi-Fi/BLE, or stopping repeated control messages causes the robot to stop.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5174`. EKO's API defaults to `http://127.0.0.1:8765` for local development.

Verification:

```bash
npm test
npm run build
cd bridge
python -m unittest discover -s tests -v
```

## Deploy to GitHub Pages

1. Create a new GitHub repository and put this project at its root.
2. Push to `main`.
3. In **Settings → Pages**, choose **GitHub Actions** as the source.
4. Optionally add a repository variable named `EKO_API_URL` containing EKO's public HTTPS API origin.
5. The included workflow tests, builds, and deploys `dist/`.

The Vite build uses relative assets and hash navigation, so it works at `https://username.github.io/repository/` without hard-coding the repository name.

GitHub Pages is HTTPS. Browsers will block an insecure `http://` robot endpoint, so Wi-Fi control requires a trusted HTTPS/WSS reverse proxy or an authenticated private gateway in front of EKO. Configure EKO with the exact Pages origin:

```dotenv
EKO_API_HOST=127.0.0.1
EKO_CORS_ORIGIN=https://username.github.io
EKO_API_TOKEN=replace-with-a-long-random-token
```

Do not expose EKO's raw Python API port directly to the public internet.

## Wi-Fi connection

Start the EKO v0.2.0+ API on the Raspberry Pi:

```bash
cd /opt/eko
source .venv/bin/activate
python main.py --api
```

Open EKO Remote, choose **Wi-Fi**, and enter the HTTPS endpoint and API token. The site opens `/ws` for telemetry and automatically falls back to `/health` and `/events` polling if WSS is temporarily unavailable.

## Bluetooth connection

Web Bluetooth requires a secure context and a user gesture for the device chooser. Use a current Chrome- or Edge-based browser on a supported OS. If Web Bluetooth is unavailable, the site disables the BLE option and Wi-Fi remains fully usable.

Install the companion bridge on the Pi:

```bash
sudo apt update
sudo apt install -y bluetooth bluez python3-venv
sudo systemctl enable --now bluetooth

cd /opt/eko-remote/bridge
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt

export EKO_API_URL=http://127.0.0.1:8765
export EKO_API_TOKEN='the-token-used-by-the-local-EKO-API'
export EKO_BLE_TOKEN='a-separate-nearby-control-token'
python eko_ble_bridge.py
```

Then choose **Bluetooth LE** in EKO Remote and select the advertised device named `EKO`. Enter `EKO_BLE_TOKEN` when one is configured. Emergency stop remains accepted even if the BLE application token is wrong.

For systemd, edit paths and the user in `bridge/eko-ble.service`, then install it:

```bash
sudo cp bridge/eko-ble.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now eko-ble.service
journalctl -u eko-ble.service -f
```

The service user must have permission to access BlueZ over D-Bus. Raspberry Pi OS installations commonly require membership in the `bluetooth` group followed by a reboot or new login.

## BLE capability matrix

| Operation | Wi-Fi | BLE |
| --- | --- | --- |
| Live status and events | WSS / polling | GATT notifications |
| Motion and emergency stop | Yes | Yes, dedicated stop characteristic |
| AI and voice settings | Yes | Yes |
| Memory and logs | Yes | Yes |
| Runtime settings | Yes | Yes |
| Camera snapshot | Fast | Supported, but chunked and slower |

BLE is a fallback control link, not a replacement for a high-bandwidth network. The protocol serializes GATT writes and fragments arbitrary JSON messages into 180-byte frames.

## Security notes

- Wi-Fi tokens and BLE tokens are separate fields.
- Credentials are stored in browser local storage only when automatic reconnect is selected.
- The GitHub Pages bundle contains no token.
- BLE pairing grants the website access to a specific device; `EKO_BLE_TOKEN` adds an application-level check.
- Hardware activation and safety acknowledgement remain restart-managed on the robot.
- Emergency stop is intentionally available without the BLE application token.

See [Architecture](docs/ARCHITECTURE.md) and [BLE protocol](docs/BLE_PROTOCOL.md) for implementation details.

## Reference documentation

- [Web Bluetooth API security and browser API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)
- [Chrome Web Bluetooth guide](https://developer.chrome.com/docs/capabilities/bluetooth)
- [GitHub Pages custom workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Bless BLE GATT server](https://github.com/kevincar/bless)
