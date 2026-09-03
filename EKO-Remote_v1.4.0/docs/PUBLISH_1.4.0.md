# Publish EKO Remote v1.4.0

## 1. Overlay the existing Git clone

```bash
rsync -a --delete \
  --exclude=.git/ \
  --exclude=node_modules/ \
  --exclude=dist/ \
  /path/to/EKO-Remote_v1.4.0/ /path/to/your/EKO-Remote/
cd /path/to/your/EKO-Remote
```

Do not copy a new `.git` folder and do not commit `.env` or an API token.

## 2. Verify

```bash
npm ci
npm test
npm run build
```

## 3. Publish

```bash
git add -A
git commit -m "Release EKO Remote v1.4.0"
git push
```

The included GitHub Pages workflow builds the site. After it finishes, hard-refresh the browser.

## 4. Connect

Use the private Tailscale Serve origin, without port 8765:

```text
https://eko.tailbedebe.ts.net
```

Re-enter the rotated `EKO_API_TOKEN` if needed. The terminal additionally requires
`terminal.enabled`, an allowed Pages origin, and Tailscale identity headers from the local proxy.
