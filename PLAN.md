# Build plan / status (orchestrator notes)

- Wave A (running 2026-10-12 ~01:50): worktrees in ../calendar-wt/{server,web-foundation,web-motion,e2e}, branches feat/*.
- Wave B (next, model sonnet): calendar UI (timeline, now marker, countdowns, events CRUD, DnD wiring) and
  task-list UI (expandable lists, reward checkbox, open-tasks tray, filters, estimates).
- Then: merge, full Playwright run (mcr.microsoft.com/playwright:v1.64.0-noble), fixes, review agent, deploy, CHANGELOG.
- Pending spec edits: settings `scene` field + `mordor` preset in spec/API.md.
- Immich stopped for RAM; restart at the end: cd /home/sauron/docker-compose/immich && docker compose start
- Owner actions: HTTPS via /home/sauron/docker-compose/traefik/HTTPS-GUIDE.md; Google OAuth setup (spec/ARCHITECTURE.md).
