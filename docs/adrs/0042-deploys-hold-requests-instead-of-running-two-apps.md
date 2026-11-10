# 0042 — Deploys hold requests at Caddy instead of running two app instances

- Status: proposed (issue #74, part 3)
- Views shaped: `deployment`

## Decision
- A deploy recreates only the app container (`docker compose up -d --no-deps --remove-orphans app`). The app gap (stop,
  start, first healthy answer) stays, but no request fails during it: Caddy's `reverse_proxy` has
  `lb_try_duration 60s` / `lb_try_interval 250ms`, so a request that finds no upstream is held and retried until the new
  container answers (a pause of a few seconds, not a 502).
- Requests in flight finish: on SIGTERM the server stops accepting, ends the live event streams (their clients reconnect),
  closes idle connections and exits when the last request is done, at most after 10 s (`server/src/lib/shutdown.ts`).
  The app service has `stop_grace_period: 15s` so Docker does not SIGKILL first (default 10 s was equal to the drain).
- Unchanged: the forced-command contract, the lock, the health wait and the rollback to `calendar:previous` (rollback is
  the same hold-and-retry path).

## Alternatives weighed
- **Blue/green, two app containers behind Caddy** (start the new one, wait for health, switch upstream, stop the old):
  true zero gap, but the two instances would share one `/data` volume. The server writes per-person JSON by
  read-modify-write with an atomic rename and no lock (`lib/personJsonStore.ts`, `lib/atomicJson.ts`) and keeps in-memory
  state; during an overlap an old-instance write can be lost to the new instance's stale copy (and the reverse), and both
  would run the push, backup and plan schedulers (`index.ts` starts them at boot), i.e. duplicate notifications and
  backups. Making that safe needs a standby mode, a write fence and cache invalidation: a feature, not a deploy tweak.
- **Old instance read-only, then new instance, then switch**: avoids lost writes, but then writes fail during the overlap
  and it still needs the fence code; no better than holding the request for a few seconds.
- **Caddy active health checks on a second upstream**: same two-instance problem.
- **Do nothing but a longer drain**: leaves 502s while Docker recreates the container.

## Why
One process owns `/data` at any time, so the data-safety argument of the single-volume design stays intact. The remaining
cost is latency, not errors: roughly the container start time (seconds on the 1 CPU VPS) plus the first health answer; a
start that takes longer than 30 s turns into a 502 (and the deploy script then rolls back). A long-lived request or a write
that was cut by the SIGKILL fallback (drain over 10 s) is the only residual failure. Assumption: seconds-long pauses are
acceptable; true zero pause would need the multi-instance work above.
Spec: not a scenario (pipeline behaviour); see `docs/DEPLOYMENT.md` "Automatic deploy".
