# Publish EKO Remote v0.5.0

Use the existing local clone of `Harsheys-I/EKO-Remote`; its `.git` directory and remote history
remain authoritative. Do not run `git init` and do not replace that `.git` directory.

```bash
rsync -av --delete \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='dist/' \
  /path/to/EKO-Remote_v0.5.0/ /path/to/your/EKO-Remote/

cd /path/to/your/EKO-Remote
npm ci
npm test
npm run build
git status
git add -A
git commit -m "Release EKO Remote v0.5.0"
git push origin main
```

Keep **Settings → Pages → Source: GitHub Actions**. After the workflow succeeds, hard-refresh the
Pages site. Connect with the exact private `https://eko.<tailnet>.ts.net` address without `:8765`,
plus the Pi API token.

If push is rejected as non-fast-forward, inspect `git log --oneline --all --graph` before changing
history. Do not start an unreviewed rebase or force-push over new remote work.
