# Publish EKO Remote v0.4.0

Use the existing local clone of `Harsheys-I/EKO-Remote` so its `.git` directory and remote history
remain authoritative. Do not run `git init`, add a second `origin`, or copy the old repository over
this release.

```bash
rsync -av --delete \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='dist/' \
  /path/to/EKO-Remote_v0.4.0/ /path/to/your/EKO-Remote/

cd /path/to/your/EKO-Remote
npm ci
npm test
npm run build
git status
git add -A
git commit -m "Release EKO Remote v0.4.0"
git push origin main
```

If `git push` reports a non-fast-forward update, stop and inspect `git log --oneline --all --graph`
before changing history. Do not start a rebase with an unreviewed release overlay and do not force
push unless you deliberately intend to replace the remote branch. The included Pages workflow runs
the same test/build gates and deploys the generated `dist` artifact; `dist` itself is not committed.

In the repository's **Settings → Pages**, keep **Source: GitHub Actions**. In the Remote connection
dialog, use EKO's exact private `https://eko.<tailnet>.ts.net` address without `:8765`, plus the Pi's
API token.
