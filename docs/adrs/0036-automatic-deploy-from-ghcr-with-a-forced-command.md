# 0036 — Automatic deploy: GHCR image, SSH with a forced command

- Status: proposed (owner approved the four CI/CD changes, 2026-11-01)
- Views shaped: `deployment`

## Decision
- After a green `CI` run on a push to `main`, `.github/workflows/deploy.yml` builds the app image, pushes it to
  `ghcr.io/<owner>/<repo>:<sha>` (`GITHUB_TOKEN`, `packages: write`) and runs it on the VPS over SSH.
- The SSH key is dedicated. Its `authorized_keys` entry has a forced command
  (`command="/opt/calendar/deploy-from-ghcr.sh",no-pty,no-port-forwarding,no-agent-forwarding,no-X11-forwarding`). The script
  accepts only an image digest (`sha256:<64 hex>`) or a commit sha (40 hex) and takes the repository from
  `/opt/calendar/deploy.env`. It pulls, keeps `calendar:previous`, restarts compose, waits for `/api/health` and rolls back
  itself, like `scripts/vps.sh deploy`. The workflow then checks `APP_URL/api/health`.
- Inert unless the variable `DEPLOY_ENABLED` is `true`. Host, host key and URL are variables (`DEPLOY_HOST`,
  `DEPLOY_KNOWN_HOSTS`, `APP_URL`), the key a secret (`DEPLOY_SSH_KEY`): nothing private is in the repo.
- One required status check, `CI result` (gate job over all CI jobs). `scripts/vps.sh deploy` stays for the first setup,
  `compose.yml`/Caddyfile changes and the Android APK, which this path does not ship.

## Alternatives weighed
- **Laptop-only deploy (today)**: nothing in CI can reach the VPS, but a merge stays undeployed until the owner is at the
  laptop and a red build can be shipped by mistake.
- **Deploy key without a forced command**: simplest, but a leaked CI secret is a root shell on the VPS. The forced command
  limits it to "run an image of this repository".
- **Pull-based polling on the VPS** (a timer or Watchtower): no inbound credential at all, but the 1 CPU / 1 GB VPS needs a
  poller that decides what "green" means, health and rollback reporting do not reach CI, and latency is the poll interval.
- **Build on the VPS**: ruled out since ADR/DEPLOYMENT: the VPS never builds.

## Why
The forced command turns the CI credential into a single-purpose capability, the digest is immutable (a moved tag cannot
change what runs), and reusing the existing health and rollback logic keeps one definition of "healthy". The package must be
public (the repo is AGPL and public) so the VPS pulls without a registry credential. Assumptions: runner and VPS are both
amd64; GHCR is acceptable as the image store.
Spec: not a scenario (pipeline behaviour); see `docs/DEPLOYMENT.md` "Automatic deploy".
