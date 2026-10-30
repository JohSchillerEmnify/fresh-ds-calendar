# 0026 — Secrets at rest

- Status: accepted (owner, 2026-10-30)
- Views shaped: `server`

## Context

The DSGVO and data-at-rest review (2026-10-30) found two plaintext secrets in the data volume: the Google refresh token
per person (`users/<sub>/google-token.json`, full Calendar access) and the raw 90-day session ids in `sessions.json`.
A copy of the volume (backup tarball, provider snapshot, mistaken `scp`) or a file-read bug would hand over both.
Encryption with a key from the same `.env` does not help against a full root compromise of the VPS; it separates
"has the data volume" from "has the secrets".

## Decision

- **Refresh tokens**: AES-256-GCM (`node:crypto`), random 12-byte IV per write, envelope
  `{ v: 1, alg: "A256GCM", iv, tag, ct }`, key `TOKEN_ENC_KEY` (32 bytes, base64) in `/opt/calendar/.env`. Legacy
  plaintext files are read and re-written encrypted on first read. A wrong key or a damaged file means "not connected"
  (the person signs in again), logged once. With `PROVIDER=google` the server refuses to start without a valid key
  (`TEST_MODE` is exempt); `scripts/vps.sh env` and `deploy` generate the key on the VPS, so it never leaves it.
  Losing the key only costs a new sign-in.
- **Sessions**: `sessions.json` is keyed by `sha256(id)`; the cookie keeps the raw id and the lookup hashes it. Raw-id
  entries from before are hashed in place on load, so nobody is signed out. Sessions also end 180 days after creation
  (legacy entries count from the migration), however often they are used.
- Incident steps live in `docs/SECURITY-RUNBOOK.md`.

## Alternatives weighed

- **LUKS full-disk encryption**: protects only against offline disk access at the provider, needs a remote unlock at
  every reboot (or a key on the same box, which is pointless), and the provider is a German company bound by
  secrecy law. Overkill for two people; reconsider with outside users.
- **Client-side encryption of the Drive backups**: the bundle already excludes tokens and sessions and sits in the same
  Google account that holds every event in plaintext; a lost key would lose the backups. Skipped.
- **App-level encryption of prefs, lists, templates**: the key would sit next to the data, so no gain against host
  compromise, plus complexity. Skipped.
- **Dropping old sessions instead of hashing in place**: simpler, but signs both people out for no benefit.
