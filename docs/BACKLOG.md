# Backlog and known bugs

Tracked here so it survives across sessions. Newest first within each section. Move an item out when it ships.

## Bugs

- **Android app: system back gesture closes the whole app** (2026-10-13, owner). With the settings, the theme menu, the
  Tasks view, or an opened task list / event open, the Android back gesture exits the app. Expected: back closes the
  topmost overlay/dialog, then navigates back in the app, and exits only from the start view.
  Likely cause (unverified): the web app handles browser history for overlays (`web/src/lib/overlayHistory.ts`), but in
  the Capacitor shell the hardware/gesture back goes to Android; it needs `App.addListener('backButton', …)`
  (`@capacitor/app`) to call `history.back()` / close the overlay and exit only at the root. Needs an APK rebuild.
- **Canvas: long press on an item row does not pick up the note** (2026-10-13, owner, phone). Not reproducible in
  Chromium mobile emulation; a defensive fix (`touch-action`, `user-select`, `-webkit-touch-callout`, prevented
  `contextmenu`/`selectstart`) shipped. Owner to retest on the phone; if it still fails, capture a remote-debug log of the
  pointer/touch events on one row.

## Waiting for the real Google login (branches on sauron and GitHub, in the preview)

- `shared-lists` — share task lists with the partner (per list and per category), server storage.
- `drive-backup` — back up all server data to the hidden Google Drive app folder; restore (contains `shared-lists`).
- `perf-budget2` — first-load JS 167 → 135 KB, Lighthouse budget = median of 3 runs ≥ 70.

Prerequisites (owner): HTTPS on a real domain (Cloudflare DNS + token in `~/docker-compose/traefik/.env.cloudflare`),
Google Cloud OAuth client (values in `~/docker-compose/calendar/.env`). See [DEPLOYMENT.md](DEPLOYMENT.md).

## Features

- Push notifications (first: the bedtime reminder; the reminder already has a sink for it).
- Tags (shelved earlier).
- iOS home-screen widget (needs a native shell; a PWA cannot provide widgets on iOS).
- Android widget: verify on a real device (drawn as a bitmap of the week view, never rendered on a device yet).

## Dropped

- Tasks board (Kanban) — owner, 2026-10-13.
- Google Keep sync — the Keep API is Workspace-only; an unofficial client was rejected.
