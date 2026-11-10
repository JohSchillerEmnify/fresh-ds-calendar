# Architecture decision records

One short ADR per cross-cutting decision: the decision, the alternatives, why it won. Add the next number to the table when you add an ADR.

| No. | Title | Status | Decision |
|---|---|---|---|
| [0001](0001-adopt-likec4-migrate-incrementally.md) | Adopt LikeC4 | accepted | The architecture is a LikeC4 model in `docs/architecture/`, migrated in slices |
| [0002](0002-two-row-week-is-a-new-component.md) | Two-row week reuses the Time grid | accepted | The two-row overview is the Time grid in a fit-to-height mode, not a new component |
| [0003](0003-machine-client-key-bound-to-one-person.md) | Machine client key | moved to the door repository | A machine client reads with its own key, bound to one person |
| [0004](0004-optional-integrations-are-plugins.md) | Optional integrations are plugins | accepted (door plugin moved out 2026-10-30) | A folder each, loaded only when configured; the registry ships empty |
| [0005](0005-google-is-the-store.md) | Google is the store | accepted | Events and task lists live in Google Calendar; no database |
| [0006](0006-task-lists-in-a-hidden-calendar.md) | Task lists in a hidden calendar | accepted | A task list is an event in a hidden per-person "tasks" calendar |
| [0007](0007-per-person-google-rate-guard.md) | Per-person rate guard | accepted | A read cache and cooldown per person sit in front of Google |
| [0008](0008-allow-listed-google-sign-in.md) | Allow-listed Google sign-in | accepted | Only allowed addresses sign in, each with their own Google access |
| [0009](0009-diagnostics-client-beacon.md) | Diagnostics client beacon | accepted | One client beacon plus whitelisted server log fields, never personal data |
| [0010](0010-backups-in-the-drive-app-folder.md) | Backups in the Drive app folder | accepted | Each person's server data is backed up to their hidden Drive app folder |
| [0011](0011-shared-lists-on-the-server.md) | Shared lists on the server | accepted | Shared task lists live on the server, not in a shared Google calendar (refines 0005) |
| [0012](0012-android-app-is-a-capacitor-shell.md) | Android app is a Capacitor shell | accepted (server choice superseded by 0022) | The Android app is a Capacitor shell that loads the calendar server |
| [0013](0013-app-sign-in-by-one-time-code.md) | App sign-in by one-time code | accepted | Sign-in runs in the system browser and returns by one-time code |
| [0014](0014-widget-reads-with-the-app-session.md) | Widget reads with the app session | accepted | The widget calls the API with the app's own session |
| [0015](0015-reminders-come-from-google.md) | Reminders come from Google | accepted | Reminders are Google's and ring on the device |
| [0016](0016-theme-files-carry-no-svg.md) | Theme files carry no SVG | accepted | An own picture is sanitised twice and shown only as an image |
| [0017](0017-undated-lists-on-an-anchor-date.md) | Undated lists on an anchor date | accepted | Undated task lists are events on a fixed anchor date (builds on 0006) |
| [0018](0018-canvas-place-on-the-list-areas-on-the-server.md) | Canvas place on the list, areas on the server | accepted | A note's place lives on its list; Canvas areas live on the server |
| [0019](0019-finished-lists-carry-a-done-marker.md) | Finished lists carry a done marker | accepted | Every write that leaves a list finished sets a private `done` marker, which the Archive reads |
| [0020](0020-material-3-components-built-in-house.md) | Material 3 built in-house | accepted | The components are built in-house on design tokens |
| [0021](0021-translations-with-vue-i18n-compiled-in-the-browser.md) | Translations with vue-i18n | accepted | Messages are compiled in the browser |
| [0022](0022-android-app-uses-one-configured-server.md) | Android app uses one configured server | accepted | The server is build configuration, not a choice (supersedes the choice in 0012) |
| [0023](0023-last-known-state-in-indexeddb.md) | Last known state in IndexedDB | accepted | The web client keeps the last shown state and shows it at once on start |
| [0024](0024-task-list-templates-live-on-the-server.md) | Task list templates on the server | accepted | A person's templates are stored on the app server, not in Google |
| [0025](0025-device-first-storage-synced-with-the-server.md) | Device-first storage | accepted | Everything is stored on the device first and only synced with the server |
| [0026](0026-secrets-at-rest.md) | Secrets at rest | accepted | Refresh tokens are sealed with `TOKEN_ENC_KEY` (AES-256-GCM); sessions are stored hashed and end after 180 days |
| [0027](0027-door-limits-and-trusted-proxy.md) | Door limits and trusted proxy | moved to the door repository | The door key has 32+ characters; 60 asks a minute per client, counted by the trusted proxy's address only when `TRUST_PROXY` is set |
| [0028](0028-origin-protection-and-security-headers.md) | Origin protection and security headers | accepted | Writes need an allowed `Origin`, JSON and at most 256 KB; every answer carries a CSP and the other security headers |
| [0029](0029-public-host-name-from-configuration.md) | Public host name from configuration | accepted | `CAL_DOMAIN` / `CAL_SERVER_URL` are required; the repo names no real host |
| [0030](0030-live-sync-with-server-sent-events.md) | Live sync with Server-Sent Events | accepted | Open apps keep one SSE connection; the server publishes a content-free nudge on every change and asks Google every 20 s while an app is open |
| [0031](0031-offline-changes-outbox-last-arrival-wins-sync-failed-icon.md) | Offline changes: outbox, last arrival wins, sync-failed icon | accepted | Changes are applied on the device and sent in order from a per-person outbox; the last to arrive wins; no marks, a sync-failed icon after 5 minutes |
| [0035](0035-settings-and-streak-per-person.md) | Settings, categories, streak and plant per person | accepted | `users/<sub>/settings.json` and `motivation.json`; the server-wide files are copied to every known person once and kept as `.bak` |
| [0034](0034-month-list-fixed-week-height-and-own-windowing.md) | Month list: fixed week height, own windowing | accepted | Months stacked with fixed week heights so only 3 are built; snapping is CSS; the URL follows the month in view with replace |
| [0033](0033-ink-strokes-in-a-server-file-per-person.md) | Ink strokes in a server file per person | accepted | Strokes live in `users/<sub>/ink.json` relative to the line height; Google gets a flag and a placeholder; about 1 MB per list, strokes stored smoothed and thinned |
| [0032](0032-m3-expressive-as-the-one-action-vocabulary.md) | M3 Expressive as the one action vocabulary | accepted | One filled primary per surface, icon-only labelled header actions, overflow menus, Compact/Expressive bars; a lint gate bans raw buttons outside `m3` |
| [0037](0037-a-calendar-plan-sets-the-hidden-flag.md) | A calendar plan sets the hidden flag | accepted | A server scheduler switches `hidden` at a plan's edges; no reader evaluates plans |
| [0038](0038-birthdays-are-a-virtual-calendar-over-birthday-events.md) | Birthdays are a virtual calendar | accepted | One app calendar `birthdays` over every birthday event and the old contacts calendar; own switch (`hidden`) and colour per person |
| [0039](0039-holiday-regions-are-a-curated-list-of-verified-google-calendars.md) | Holiday regions are a curated list of verified Google calendars | accepted | 65 countries, ids built by the server in the app language, each checked with `calendars.get`; added and removed in the person's Google list |
| [0040](0040-apk-is-built-in-ci-signed-in-a-protected-environment.md) | APK built in CI, signed in a protected environment | proposed | Unsigned build job, signing only in the `android-release` environment, a release `apk-<version>`, shipped by the forced command `apk <tag>` after a pin check (supersedes the laptop-only part of 0036) |
| [0041](0041-map-picker-uses-leaflet-and-device-location-on-tap.md) | Map picker | accepted | Leaflet on the existing tiles, Photon reverse, device position asked on tap only |
