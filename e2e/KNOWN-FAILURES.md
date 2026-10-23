# Known failures

## performance.feature (@perf, mobile)
- "The app scores well in a phone performance audit": 85-86 under heavy machine load (needs >= 90); passed earlier on
  a quieter machine. Re-run when the host is idle.
- "The server stays small when idle": rss 80.4-84 MB vs < 80 MB. Bare node is 40 MB, hono + @hono/node-server about
  20 MB, router/first request about 10 MB. Borderline, host dependent.
