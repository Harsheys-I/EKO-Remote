# Publish EKO Remote v1.3.0

## 1. Overlay the existing Git clone

```bash
rsync -a --delete \
  --exclude .git \
  --exclude node_modules \
  --exclude dist \
  /path/to/EKO-Remote_v1.3.0/ /path/to/your/EKO-Remote/
```

Never copy `.env` or a robot token into the repository.

## 2. Test and build

```bash
cd /path/to/your/EKO-Remote
npm ci
npm test
npm run build
```

## 3. Commit and publish

```bash
git add -A
git commit -m "Release EKO Remote v1.3.0"
git push
```

Use **GitHub Actions** as the Pages source. Wait for the workflow to finish, hard-refresh the site,
and reconnect to the existing Tailscale HTTPS robot URL.

## 4. Acceptance

- Normal right rail shows the same committed expression/revision as the physical OLED pair.
- Debug mode streams new logs without duplicates.
- AI answers stay visible and the voice-reply switch updates the robot live.
- House Map loads the backend layout, creates every item type, selects and edits exact values,
  saves, survives reload, and retains the layout after **Reset trail**.
- Drive continues to show the missing-driver lock and never offers a browser-only bypass.
