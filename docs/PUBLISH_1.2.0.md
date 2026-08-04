# Publish EKO Remote v1.2.0

Overlay this release onto the existing Git repository without deleting `.git`:

```bash
rsync -a --delete \
  --exclude .git \
  --exclude node_modules \
  --exclude dist \
  /path/to/EKO-Remote_v1.2.0/ /path/to/your/EKO-Remote/
```

Run the release gates:

```bash
cd /path/to/your/EKO-Remote
npm ci
npm test
npm run build
```

Commit and push:

```bash
git add -A
git commit -m "Release EKO Remote v1.2.0"
git push
```

Keep GitHub Pages configured to deploy through the included GitHub Actions workflow. After the
deployment completes, hard-refresh the site. Connect to the Pi through its Tailscale HTTPS origin
without `:8765`.

On the AI page, verify that **EKO voice replies** changes the robot's `voice_responses` setting.
The answer should remain in chat in either position; with the switch on and ElevenLabs configured,
EKO should also speak it.
