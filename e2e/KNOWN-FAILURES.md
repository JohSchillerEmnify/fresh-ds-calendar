# Known failures

## performance.feature (@perf, mobile)
- "Switching views and opening dialogs repeatedly does not leak memory" and "Reward effects and drag and drop leave
  nothing behind": the `heap` check fails (about +30 %, +1.3 MB on a 4.5 MB baseline). Heap snapshots (JS-only objects)
  show no growing app objects; DOM nodes and listeners stay flat. The growth is V8 optimised code
  (InstructionStream), first-use warm-up of dialogs / drag code and Chromium performance-timeline entries counted by
  `Runtime.getHeapUsage`. Budget not raised; needs an owner decision (warm-up before the recording or a larger baseline).
- "The app scores well in a phone performance audit": 85-86 under heavy machine load (needs >= 90); passed earlier on
  a quieter machine. Re-run when the host is idle.
- "The server stays small when idle": rss 80.4-84 MB vs < 80 MB. Bare node is 40 MB, hono + @hono/node-server about
  20 MB, router/first request about 10 MB. Borderline, host dependent.

## adhd-support: "A weekly task list repeats and each week is ticked separately" (@optional, mobile + desktop)

Ticking an item on the first occurrence (the recurring master) also shows the tick on 2026-10-21: the mock provider
expands virtual instances by cloning the master's private properties (`items` with done flags), like Google does for
unmodified instances. Fix needs a server design decision (on a tick of a master with a rule, split the first occurrence
into an exception event, or reset `done` when expanding). Left open: optional feature, server/provider work outside the
events UI group.
