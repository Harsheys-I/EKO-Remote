# Publish EKO Remote v1.0.0

Do not replace the existing repository history. Overlay the complete release onto the current
local clone:

```bash
rsync -a --delete \
  --exclude .git \
  --exclude node_modules \
  --exclude dist \
  /path/to/EKO-Remote_v1.0.0/ /path/to/your/EKO-Remote/

cd /path/to/your/EKO-Remote
npm ci
npm test
npm run build
git status --short
git add -A
git commit -m "Release EKO Remote v1.0.0"
git push
```

In GitHub, open **Settings > Pages** and select **GitHub Actions**. Wait for the included workflow
to finish, then hard-refresh the Pages site.

Connect with the Tailscale Serve origin, without port `8765`:

```text
https://eko.YOUR-TAILNET.ts.net
```

The old browser connection profile may be forgotten from Settings if its endpoint or token changed.
The Debug Mode preference is local to each browser.
