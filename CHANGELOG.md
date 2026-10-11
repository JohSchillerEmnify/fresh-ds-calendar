# Changelog

## Iteration 1 — walking skeleton (2026-10-12)

Live at **http://cal.mordor.local** (also linked on Homepage as "Calendar").

What you can see:
- App shell, mobile first (works at 375px): top bar with the current period, **Today**, previous/next.
- Bottom tab bar **Month / Week / Day**; floating **+** button opens a "coming soon" sheet.
- Month view: Monday-first grid of the real month, today highlighted; tap a day to open its day view.
- Week view: Mon–Sun columns with an hourly grid (24h). Day view: hour list.
- Deep links: `/month/2026-10`, `/week/2026-10-12`, `/day/2026-10-12`; `/` opens the current month.
- Light and dark mode (follows the phone setting).
- PWA basics: manifest, placeholder icons (192, 512, maskable, apple-touch-icon), service worker, iOS meta tags.
  Installing needs HTTPS, which is still an owner action.

Not yet: events, task lists, Google sync (no data is shown yet).

Under the hood:
- `server/`: Fastify (Node 22, TypeScript), `GET /api/health`, serves the built web app with SPA fallback.
- `web/`: Vue 3 + Vite + Pinia + Vue Router + date-fns.
- Single Docker image; compose file at `/home/sauron/docker-compose/calendar/docker-compose.yaml`.
- Redeploy: `scripts/deploy.sh` (runs tests, rebuilds, waits for health).
