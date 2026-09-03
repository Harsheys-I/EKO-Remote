# Connect GitHub Pages to EKO over HTTPS

The deployed Remote is an HTTPS page. A browser will block its JavaScript from fetching EKO at a
plain LAN address such as `http://192.168.18.26:8765`.

Use EKO v1.4.0's private Tailscale Serve setup:

1. Install Tailscale on the Raspberry Pi and the controlling laptop or phone.
2. Join both devices to the same tailnet.
3. Enable MagicDNS and HTTPS certificates in the Tailscale admin DNS page.
4. Set `EKO_API_HOST=127.0.0.1`, a long `EKO_API_TOKEN`, and
   `EKO_CORS_ORIGIN=https://harsheys-i.github.io` in the Pi's `/home/pi/EKO/.env`.
5. Restart EKO and run `/home/pi/EKO/deploy/setup_tailscale_https.sh`.
6. Enter the printed `https://eko....ts.net` address and API token in EKO Remote.

Do not append port `8765` to the Tailscale HTTPS address. Tailscale terminates trusted HTTPS/WSS
on port 443 and proxies privately to EKO on `127.0.0.1:8765`. Do not forward the raw API port on
your router.

Live telemetry, structured debug logs, and the optional PTY use WSS on the same private hostname.
The controlling browser must be signed into the tailnet. Keep the Pi API on loopback: the terminal
trusts Tailscale identity headers only on the local Serve-to-EKO proxy hop, never from a direct LAN
client.
