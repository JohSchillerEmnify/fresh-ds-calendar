# Build plan / status (orchestrator notes)

- Wave A (running 2026-10-12 ~01:50): worktrees in ../calendar-wt/{server,web-foundation,web-motion,e2e}, branches feat/*.
- Wave B (next, model sonnet): calendar UI (timeline, now marker, countdowns, events CRUD, DnD wiring) and
  task-list UI (expandable lists, reward checkbox, open-tasks tray, filters, estimates).
- Then: merge, full Playwright run (mcr.microsoft.com/playwright:v1.64.0-noble), fixes, review agent, deploy, CHANGELOG.
- Pending spec edits: settings `scene` field + `mordor` preset in spec/API.md.
- Immich is running again (started by something else ~02:20); no restart needed. Do not stop it again without asking.
- Owner actions: HTTPS via /home/sauron/docker-compose/traefik/HTTPS-GUIDE.md; Google OAuth setup (spec/ARCHITECTURE.md).

## Status 2026-10-12 ~07:30 (session limit hit again; resets 09:50)
- Master has everything merged + deployed (iteration 2). Worktrees fix-core / fix-events / fix-tasks (branches of same names)
  hold partial e2e-fix work from 3 agents killed by the limit: check `git -C ../calendar-wt/<w> log/status`, resume with Sonnet.
- Merged branches feat/* are done. Immich still stopped: restart at the very end (cd /home/sauron/docker-compose/immich && docker compose start).

## Owner feedback 07:20 (from phone screenshots) — HIGH PRIORITY, do before more e2e work
1. Mobile bug: /day view overflows horizontally (page wider than viewport, title clipped on left, plant card cut off right).
   Fix: no horizontal page scroll (AC 375px), check day view + plant card positioning (clamp to viewport).
2. Mobile bug: timed task-list block in week view renders garbled (title "Weeker…" + "vaccuum flat…" + "Do thing" overlap).
   Fix card layout for timed blocks in narrow columns.
3. Completed task lists (all items ticked) must look done in calendar views: strike through the whole list title/items,
   dimmed (not only the n/n indicator).
4. Month view with tasks: show the individual tasks (item names) inside the day cell when space allows; show names
   fully when there is room (use container queries; phone month stays compact).
5. SHELVED by owner 07:5x (focus on core): range slider to choose how many days the calendar shows: 1,2,3,4,5,6,7 days, then 2,3,4 weeks (custom N-day view,
   like Google's "custom view"). Implement as a view setting/segmented control + slider; week keeps Monday start;
   persist in settings (defaultView/rangeDays) and URL. Add spec scenarios (spec/features/range.feature + STEPS.md + ACs).

## Process rules (owner 2026-10-12)
- Deploy previews BEFORE merging (active development): `scripts/preview.sh up <branch-name>` serves the worktree
  calendar-wt/<name> at http://<name>.cal.mordor.local (mock data, isolated). `down <name>` removes it. Tell the owner the URL, merge after OK
  (or merge when owner is asleep, but still keep previews of big UI changes up for review).
- Shelved: range/slider view.
- Load: serialize Playwright/docker runs with `flock /tmp/calendar-e2e.lock <cmd>`.
- LATER (owner): German translation (i18n; UI strings extracted, de + en, Europe/Berlin locale, week Monday). Not started.
- LATER (owner): long press WITHOUT moving shows resize handles on events (visual resize). Not started.

## Status 2026-10-12 ~11:40
- Master (3b22000) = all of: wave A/B features, fix-core, fix-events, tl-display, sheet-swipe, multiday (bars+overlap cascade), dnd-fix.
  NOT yet deployed live (cal.mordor.local runs an older build): run `scripts/deploy.sh` (all-JS size limit is 148 kB).
- Open branch/worktrees: timed-tl (agent a61a21bbecd1d6bf2 working: timed task-list items, fade/shrink truncated rows, section-level
  collapse "Titles only / Compact / Detailed" for the task area, collapsible Now card). Preview: http://timed-tl.cal.mordor.local
  (preview.sh up timed-tl to refresh). Merge after owner OK.
- fix-tasks (agent a6e24e2c93635f109): e2e fixes for tasklists/reward/streak/plant/sunflowers/perf; not reported yet; merge when done.
- Remaining: full e2e run on merged master (flock /tmp/calendar-e2e.lock pnpm e2e), review agent, final deploy, CHANGELOG.
- Owner-approved previews: multiday looked good (merged). Later items: German translation, resize handles on long press, range slider (shelved).
- Owner idea backlog is in this file; user prefers previews before merge, Sonnet agents, token-efficient work.

## Auto-deploy (owner 2026-10-12: "always deploy on merge")
- git hooks in scripts/hooks (core.hooksPath) call scripts/auto-deploy.sh after a merge on master in the main checkout:
  tests + docker build + restart, serialized, log /tmp/calendar-autodeploy.log, last deployed sha in /tmp/calendar-deployed-sha.
- Merging a branch to master therefore deploys it live automatically. Still do `scripts/preview.sh up <branch>` BEFORE merging.
- Manual: `FORCE_AUTODEPLOY=1 scripts/auto-deploy.sh`. Failed deploy leaves the old version running.

## Resource rules (owner 2026-10-12): PIHOLE (home DNS) RUNS ON THIS BOX — do not starve it
- Heavy jobs (e2e, docker build, docker playwright, full vitest) only via `scripts/lowprio.sh <cmd>`: nice 19, ionice idle,
  one heavy job machine-wide (flock /tmp/calendar-heavy.lock). e2e/run.sh and preview/auto-deploy already do this; e2e container capped 1.5 CPU / 2 GB.
- E2E is expensive: NEVER run the whole suite casually. Narrow --grep only; full run only once, at the end, when idle (check `uptime` < 4 and pihole DNS fast:
  `time nslookup google.com 127.0.0.1`). Prefer unit tests for iteration.
- Watch: `uptime`; if load > 8 pause new heavy work.
