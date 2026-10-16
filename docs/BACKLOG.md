# Backlog and known bugs

Tracked here so it survives across sessions. Newest first within each section. Move an item out when it ships.

## Bugs

- **Zooming is broken on the month overview** (2026-10-16, owner). The pinch/Ctrl-wheel zoom on the month view is
  broken; investigate and fix. (Separate from the zoom-month lab.)
- **Deep-link return after sign-in is sometimes lost** (2026-10-16, owner chose backlog). Opening a specific page while
  signed out should return there after sign-in; ~1 in 8 it lands on the default month view instead. Pre-existing, cosmetic
  (you are signed in correctly, just on the wrong starting page). The return is stashed in `sessionStorage` (`RETURN_KEY`)
  by the router `beforeEach` and read by the `/` redirect (`takeReturn`, `web/src/router/index.ts`); the two cross during
  the sign-in redirect. Reproduce: `e2e/run.sh --grep "and sees their calendar" --repeat-each 8` (fails ~1/8 on main).
- **Android back gesture fix: verify on the phone** (branch `android-back-notify`, needs an APK build). Back should
  close the open overlay, then go to the previous view, and leave the app only with no history left.
- **Canvas: long press on an item row does not pick up the note** (2026-10-13, owner, phone). Not reproducible in
  Chromium mobile emulation; a defensive fix (`touch-action`, `user-select`, `-webkit-touch-callout`, prevented
  `contextmenu`/`selectstart`) shipped. Owner to retest on the phone; if it still fails, capture a remote-debug log of the
  pointer/touch events on one row.

## Waiting for the real Google login (branches on sauron and GitHub, in the preview)

- `shared-lists` — share task lists with the partner (per list and per category), server storage.
- `drive-backup` — back up all server data to the hidden Google Drive app folder; restore (contains `shared-lists`).
- `perf-budget2` — first-load JS 167 → 135 KB, Lighthouse budget = median of 3 runs ≥ 70.

Prerequisites (owner): HTTPS on a real domain (Cloudflare DNS + token in `~/docker-compose/traefik/.env.cloudflare`),
Google Cloud OAuth client (values in `~/projects/calendar/deploy/.env`). See [DEPLOYMENT.md](DEPLOYMENT.md).

## Features

- Canvas performance on the phone (owner, 2026-10-14): pan/zoom/drag are already one transform and save on release; the
  cost is re-layerizing all notes each frame (~40 notes, about half the frames dropped at 8x CPU throttle). Real fix:
  render only the notes in the viewport (or `content-visibility`), needs a spec decision and a real-device trace. Idle
  frames also drop, so check the ambient scene/top-bar animations with remote debugging on the phone.
- Push notifications in the PWA (Web Push, needs HTTPS). The Android app shows the bedtime reminder as a notification
  (branch `android-back-notify`; needs an APK build and a check on the phone).
- Tags (shelved earlier).
- iOS home-screen widget (needs a native shell; a PWA cannot provide widgets on iOS).
- Android widget: verify on a real device (drawn as a bitmap of the week view, never rendered on a device yet).
- Two-row week overview (owner, 2026-10-16): instead of 7 narrow day columns, lay the week out in two rows — the first
  four days on top, the rest below — to use the width better and read as a nicer overview. A layout option/view for the
  week.
- Phone UI feels overwhelming and too small (owner, 2026-10-14). Clarify with the owner first which part bothers most.
  Candidates: a larger "comfortable" density on phones; a month view with dots per day plus the selected day's list
  below; fewer toolbar controls; a day/agenda start view on phones.

## Dropped

- Tasks board (Kanban) — owner, 2026-10-13.
- Google Keep sync — the Keep API is Workspace-only; an unofficial client was rejected.
