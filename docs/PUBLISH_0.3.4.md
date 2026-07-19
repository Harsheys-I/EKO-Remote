# Publish EKO Remote v0.3.4

Use a fresh clone of the existing GitHub repository so its history and Pages settings remain intact:

```bash
cd ~/Projects
git clone https://github.com/Harsheys-I/EKO-Remote.git EKO-Remote-publish
rsync -a --delete \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='dist/' \
  /path/to/EKO-Remote_v0.3.4/ EKO-Remote-publish/
cd EKO-Remote-publish
npm ci
npm test
npm run build
git add -A
git commit -m "Release EKO Remote v0.3.4"
git push origin main
```

In GitHub, keep **Settings > Pages > Source** set to **GitHub Actions**. The workflow runs on the
push and deploys `dist/`. The optional repository variable `EKO_API_URL` may contain EKO's private
Tailscale HTTPS address; API tokens and cloud keys must never be stored in GitHub variables or the
frontend repository.
