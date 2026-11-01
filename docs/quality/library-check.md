# Library check

Step 6 of the quality plan. It lists every in-house implementation of generic infrastructure, the maintained library
that could replace it, and a recommendation. Nothing is replaced in this pass. Versions were checked on npm on
2026-11-01.

Libraries already in the repo: web: `@vueuse/core` 15, `date-fns` 4, `idb` 8, `vue-i18n`, `vue-router`, `pinia`,
`perfect-freehand`, `@material/material-color-utilities`, `dompurify`, workbox 7 (`-precaching`, `-routing`,
`-strategies`). server: `hono` 4.13, `valibot` 1.5, `web-push`, `dompurify`, `jsdom`. `shared/` has no dependencies, on
purpose: it is plain ESM that both sides import without a build step.

## Top replacement candidates

| # | In-house | Replace with | Why it is worth it |
|---|----------|--------------|--------------------|
| 1 | about 10 copies of `try { localStorage… } catch {}` (tasklists `section.ts`, `collapse.ts`, `canvasStore.ts`, `native/apkHint.ts`, `i18n/index.ts`, `pwa/releaseNotes.ts`, `pwa/install.ts`, `extensions/create.ts`, `stores/ink.ts`) | `useStorage` from `@vueuse/core` 15 (already a dependency) | No new dependency. It removes the duplication and gives reactive, SSR- and quota-safe access in one place. |
| 2 | Origin allow-list CSRF check in `server/src/api/guards.ts` | `hono/csrf` (part of `hono` 4.13, already installed) | It is the same check (Origin / Sec-Fetch-Site) maintained upstream. Keep the JSON-only and body-limit parts as they are. |
| 3 | Tile cache with a hand-trimmed 200-entry limit and max age in `web/src/pwa/tileCache.ts` | `workbox-expiration` 7.4 (`ExpirationPlugin`), next to the workbox packages already used in `sw.ts` | It is the same family as the routing and strategies already in use. It does the entry and age limits, and it handles quota errors. |
| 4 | Hand-written theme and picture validator in `shared/index.js` (184 lines) next to the existing JSON Schema `shared/theme.schema.json` | `valibot` 1.5 (already used by the server), or `ajv` against the existing schema | It would give one source of truth instead of a schema plus a parallel walker. Cost: `shared/` gains a dependency, and the web bundle gains the validator. Measure with `size-limit` first. |
| 5 | Web time zone maths `web/src/features/calendar/zone.ts`, a mirror of `server/src/lib/time.ts` | Move it into `shared/` (no library), or use `date-fns` 4 with `@date-fns/tz` | The duplication is the problem. Sharing one Intl-based module needs no new dependency. A library only helps if the bundle budget allows it. |

## Full inventory

The **Rec.** column means:

- **replace**: worth doing in a later pass.
- **maybe**: measure or decide first.
- **keep**: the in-house code stays, for the reason given in the last column.

### Storage and caching

| In-house (file) | What it does | Library | Rec. | One-line reason |
|---|---|---|---|---|
| `web/src/lib/deviceDb.ts` | key-value store per person over IndexedDB | `idb` 8 (already the base) | keep | It is already a thin wrapper over the library (ADR 0023/0025). |
| `web/src/stores/device.ts` | device copy plus a 50 ms debounced save | `useDebounceFn` (`@vueuse/core`) | maybe | It is a small win. The save is tied into the restore timeout. |
| localStorage try/catch copies (see top 1) | settings that are only on the device | `useStorage` (`@vueuse/core`) | **replace** | See top 1. |
| `server/src/lib/atomicJson.ts`, `personJsonStore.ts` and the per-person stores | JSON files written atomically (temp file plus rename) | `write-file-atomic`, `lowdb` | keep | 18 + 62 lines. Files on disk are the design (ADR 0005/0025), and a library adds little. |
| `web/src/pwa/tileCache.ts` | limited cache of map tiles | `workbox-expiration` 7.4 | **replace** | See top 3. |
| `web/src/stores/items.ts` (6-range LRU) | evicts loaded ranges | `lru-cache` 11 | keep | About 5 lines. The eviction also drops items no longer referenced, which `lru-cache` does not do. |
| `server/src/providers/google/RateGuard.ts` | TTL cache, single-flight, rate-limit cooldown | `lru-cache` (TTL plus `fetchMethod`), `p-retry` 8 | keep | The per-person cooldown and the stale answers are domain rules (ADR 0007). A library covers only the cache part. |

### Sync, retry and rate limits

| In-house (file) | What it does | Library | Rec. | One-line reason |
|---|---|---|---|---|
| `web/src/lib/outboxEngine.ts`, `outbox.ts`, `stores/outbox.ts` | ordered offline outbox, 412 resend on the newest etag | `workbox-background-sync` 7.4, `dexie` 4 | keep | ADR 0031. The server of record is Google behind our API, and the ordering, id renames and refusals are domain rules. |
| `web/src/stores/sync.ts`, `server/src/services/changeFeed.ts` | sync triggers, "changes since" | none fits (the Google sync token is specific) | keep | ADR 0025/0030. |
| retry and backoff in `api/client.ts` (Retry-After), `googlePoller.ts`, `RateGuard.ts` | waits and cooldowns | `p-retry` 8, `ky` 2 | maybe | Spread over 3 places. `p-retry` could unify the poller backoff, while Retry-After handling stays custom. |
| `server/src/api/idempotency.ts`, `idempotencyStore.ts` | replays the answer for an `Idempotency-Key` for 24 h | no maintained Hono middleware | keep | It is a durable store with shared in-flight runs, and there is no fitting library. |
| debounce, daily and min-interval timers in `backupService.ts`, `backup.ts`, `push.ts` | backup and push scheduling | `croner`, `p-throttle` 8 | keep | A few timers, each testable with the injected clock. A cron library adds nothing. |
| `bundle`/`unbundle` in `backupService.ts` | custom archive of the backup files | `tar-stream` 3 | maybe | Only worth it if the format has to be opened by standard tools. Changing it breaks existing backups. |
| `server/src/services/changeBus.ts`, `livePublisher.ts` | in-memory pub/sub, SSE connection registry | `mitt` 3, Node `EventEmitter` | keep | 62 + 79 lines with per-person caps. Node's built-in `EventEmitter` would be the only option, and it is not clearly simpler. |
| `server/src/api/liveRoutes.ts` | SSE stream with heartbeat | `hono/streaming` (already used) | keep | It already uses the library. |
| `web/src/lib/liveSync.ts` | EventSource plus a visibility gate | `useEventSource` (`@vueuse/core`) | maybe | 79 lines. The vueuse version would need the same gate and reconnect rules. |

### Gestures, drag and drop, motion

| In-house (file) | What it does | Library | Rec. | One-line reason |
|---|---|---|---|---|
| `web/src/motion/drag.ts` (908 lines) plus `features/calendar/dnd.ts`, `tasklists/useItemDrag.ts`, `resize.ts`, `edgeTurn.ts` | pointer and touch drag state machine, slot and cell hit tests, edge turn | `@atlaskit/pragmatic-drag-and-drop` 4, `interactjs` 1.10, `@formkit/drag-and-drop` 0.6 | keep | It follows the iOS long-press and scroll rules (non-passive touchmove from mount), carries ghosts across a view turn, and is covered by e2e. None of the libraries does that, and a swap would be a rewrite. Revisit only if the bugs keep coming. |
| `web/src/composables/useSwipe.ts`, `useSwipeCarousel.ts` | swipe and flick carousel | `useSwipe` (`@vueuse/core`), `@use-gesture/vanilla` 10.3 | maybe | `useSwipe` from vueuse could replace `useSwipe.ts` (45 lines). The carousel needs its own axis lock and velocity. `@use-gesture` has had no release since 2024. |
| `features/labs/zoom/zoomGestures.ts`, `labs/clock/useDialGesture.ts`, `tasklists/useCanvasPointer.ts` | pinch, wheel zoom, long press, pan | `@use-gesture/vanilla` 10.3 | keep | These are Labs and Canvas gestures tied to their own geometry. The library is barely maintained. |
| `web/src/motion/spring.ts` | analytic spring, CSS `linear()` easing | `motion` 14.9 | keep | 189 lines with no dependency. `motion` costs about 18 kB+ for what the app uses as a few functions. |
| `motion/level.ts`, `effects.ts`, `animate.ts`, `sound.ts`, `haptics.ts`, `lib/ripple.ts` | motion level, particles, ripple, sound | `motion`, `useReducedMotion`-style helpers | keep | They are small and tied to the M3 Expressive vocabulary (ADR 0032). |
| `web/src/lib/overlayHistory.ts` | the back button closes the top overlay | none (vue-router has no overlay stack) | keep | 98 lines and specific to the router. |

### Lists, layout and components

| In-house (file) | What it does | Library | Rec. | One-line reason |
|---|---|---|---|---|
| `web/src/lib/monthList.ts`, `views/MonthScroller.vue` | windowing of the month list | `@tanstack/vue-virtual` 3.13 | keep | ADR 0034. A fixed week height makes it plain arithmetic, and the library would not help with snapping or the pinned row. |
| `web/src/components/m3/*` | Material 3 Expressive components | Vuetify, PrimeVue, `@material/web` | keep | ADR 0020/0032. There is no M3 Expressive library for Vue, and the alternatives break the 150 kB budget. |
| `extensions/registry.ts`, `server/src/plugins/registry.ts` | registries for features and plugins | none | keep | ADR 0004. They are a few arrays, and a library would add nothing. |

### Dates, parsing and validation

| In-house (file) | What it does | Library | Rec. | One-line reason |
|---|---|---|---|---|
| `web/src/lib/dates.ts` (`format`, `parseIsoDate`) | date format and strict parse | `date-fns` 4 `format`/`parse` (already a dependency) | keep | The code says why: `format` plus locale costs ~9 kB and `parse` ~11 kB gzipped on the first load. |
| `server/src/lib/time.ts` | time zone maths with Intl | `@date-fns/tz`, `Temporal` (when Node ships it unflagged) | keep | It is DST-safe and tested, with no dependency on the server. Revisit when `Temporal` is available. |
| `web/src/features/calendar/zone.ts` | copy of the server zone maths | move it to `shared/` | **replace** | See top 5. |
| `server/src/services/taskCodec.ts` | writes `RRULE:FREQ=…` strings | `rrule` 2.8 | keep | There is no RRULE parsing or expansion, because Google expands the rules. `rrule` has not had a release since 2023. |
| `shared/index.js` validator | validates themes and pictures | `valibot` 1.5 or `ajv` | maybe | See top 4. Measure the bundle cost first. |
| `features/calendar/eventForm.ts`, `tasklists/validate.ts` | form checks | `valibot` | keep | These are small field rules with i18n messages, and a schema library adds no clarity here. |
| `server/src/services/releaseNotes.ts`, `web/src/pwa/releaseNotes.ts` | reads CHANGELOG sections | `marked` | keep | It only splits our own fixed heading format. |
| `web/src/theme/importText.ts` | cleans pasted AI text around JSON | none | keep | 27 lines of app-specific repairs. |

### Colour, ids and crypto

| In-house (file) | What it does | Library | Rec. | One-line reason |
|---|---|---|---|---|
| `web/src/api/colors.ts` (luminance, contrast) | WCAG contrast for text on colours | `@material/material-color-utilities` (already a dependency) or `colord` 2.10 | maybe | The M3 utilities work in tones, not sRGB WCAG ratios. `colord` with its a11y plugin is a clean option at about 2 kB. |
| `shared/colors.js` | nearest Google colour id (CIELAB ΔE) | `culori` 4 | keep | 58 lines in `shared/` with no dependency. `culori` would be the first dependency there. |
| `web/src/lib/ink.ts` (`parseColour`) | parses computed CSS colours | `culori` 4, `colord` | maybe | It could share the library picked for `colors.ts`, if one is adopted. |
| `server/src/lib/ids.ts`, `web/src/lib/outbox.ts` (`randomText`) | nanoid-style ids | `nanoid` 6 | keep | 26 lines. `getRandomValues` is kept on purpose for insecure LAN origins, where `crypto.randomUUID` fails. |
| `server/src/lib/secretBox.ts`, `auth/sessions.ts`, `auth/oauth.ts` | AES-GCM at rest, hashed sessions, signed state | `node:crypto` (built in), `iron-session` | keep | ADR 0026/0013. They are thin layers over `node:crypto`, and a session library would not fit the one-time-code sign-in. |
| `shared/ink.js` | per-stroke merge | CRDT (`yjs`) | keep | ADR 0033 rejected a CRDT. |
