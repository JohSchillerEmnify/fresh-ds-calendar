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
