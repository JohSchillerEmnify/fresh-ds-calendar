# The app opens with the last known state

Owner (2026-10-23): "the app sometimes takes quite long to load things if internet is bad, we should load the last
known state in case of internet being gone". Spec: `spec/features/app/last-known-state.feature` (owner-approved
scenarios 1–5, plus the owner's answers: the "Last updated HH:mm" note in scenarios 1 and 2; keep ±4 weeks around
today). ADR 0023, LikeC4 `calendar.web.lastKnown` + dynamic view `openingWithLastKnownState`.

## As Is

- Only the app shell is precached by the service worker (`web/src/sw.ts`, `/api` is NetworkOnly).
- Items live in an in-memory Pinia range cache (`stores/items.ts`, LRU of 6 ranges); settings, prefs, calendars and
  imported themes have no persisted copy. The theme pref (`cal.theme`) and the language (`cal-lang` style key) are cached
  in localStorage already.
- `main.ts` waits for `/api/config`, `/api/settings`, the theme (bounded by a 4 s budget) and the session check (not
  bounded) before mounting; the router guard awaits `auth.check()` (`/api/auth/me`, no timeout) on every first route.
  On a slow server the first paint waits for the slowest of these; offline the app opens empty with the banner.

## To Be

- After every successful update the web client writes a snapshot of what it shows (config, settings, prefs, calendars,
  imported themes, and the items of every range it showed) to IndexedDB, keyed by the signed-in person.
- On start, when a snapshot exists for the person last signed in on this device, the app applies it and mounts at once
  (no waiting for any request); the usual loads run in the background and replace the restored data as they answer.
- While the shown calendar comes from the snapshot and no fresh answer has arrived yet, a small note
  "Last updated HH:mm" (time of the last successful update, app clock) shows under the banners.
- Signing out (and reaching the sign-in page at all) removes the snapshot from the device.

## Assumptions and decisions (owner asleep; recorded here)

- A1 (approved): IndexedDB in the page, per person, NOT the service worker; pwa.feature "API requests are never served
  from the service worker cache" stays true.
- A1a: the person key is the e-mail address `/api/auth/me` returns (lower-cased; `-` when sign-in is off). The API has no
  user id on the client and the e-mail is what the server's allow-list and sessions key on; adding an id to `/me` would
  change the API for no gain.
- A1b: which person's snapshot to restore offline (no `/me` answer) = a pointer `cal.lastKnownPerson` in localStorage,
  written on save; `clearPersonalStorage` already removes every `cal.*` key on sign-out. A `/me` answer for a
  different person drops the restored data and wipes the store. Only one person's snapshot is kept at a time (a save
  deletes the others), so nothing of a previous person lingers.
- A1c: reaching `/signin` (sign-out, expired session, 401 redirect) wipes the store, so a different person signing in
  next never sees the previous person's calendar, not even for a moment.
- A2: the Android shell loads the web app from the server URL and its service worker; the snapshot lives in the
  WebView's IndexedDB like in a browser. Verified only by reading the code (no device run tonight): see report.
- A3 (approved): reminders unchanged. Restored items are kept out of `items.ranges` (a separate `restoredIds` set kept
  by gc), so `windowLoaded()` in `transitionWarning.ts` still only counts fresh server ranges: only fresh data may
  cancel native reminders or replace the server's push plan. The in-app reminder snackbar may ring from restored data
  (it only shows, never cancels).
- A4: "seen" = ranges that were the visible range (`items.visible`, incl. its "today" part); prefetched neighbours are
  not kept, so a never-visited next week stays empty offline (scenario 4).
- A5: keep window = ranges overlapping [today − 28 days, today + 28 days); items outside are dropped on save and
  restore (pruned on every save).
- A6: the note shows the time only (owner's wording "Last updated 08:12") when the update was today, and the short date
  plus time otherwise (a bare time of an older day would mislead). Texts in en/de/de-x-mainfr/de-x-coldmirror.
- A7: writes while offline are still refused (sync.feature @offline unchanged); nothing is queued.
- A8: no new dependency: a ~40-line IndexedDB wrapper (get/set/clear on one object store), injectable, with an
  in-memory implementation for unit tests (jsdom has no IndexedDB). The IDB code path is covered by the e2e scenarios.
- A9: e2e slow server = new test hook `POST /api/__test/slow { ms }` (every non-test `/api` answer waits `ms`; reset
  clears it). Playwright `route` cannot see requests the service worker makes, the server-side delay can.

## Requirements

1. R1 Save: after a successful update, the client stores {config, settings, prefs, calendars, imported themes, seen
   ranges with their items, savedAt} for the signed-in person in IndexedDB, debounced, never before a fresh answer.
2. R2 Merge: a newly saved range replaces, in older saved ranges, every item it contains or whose days it covers
   (deleted/moved items do not come back); ranges are de-duplicated by `from_to`.
3. R3 Prune: ranges and items not overlapping ±28 days of today are dropped on save and on restore.
4. R4 Restore: at start (not on `/signin`), the snapshot of the pointer person is applied to clock config, settings,
   prefs, calendars, themes and items before the first route; the app mounts without waiting for the network.
5. R5 Refresh: fresh answers replace restored data; restored items overlapping a fresh range are dropped.
6. R6 Note: `last-updated-note` shows "Last updated HH:mm" while restored and not yet refreshed.
7. R7 Wipe: sign-out (either kind) and opening `/signin` delete the snapshot; a `/me` answer for another person drops
   restored data and wipes.
8. R8 Reminders: restored items never count as loaded ranges for `windowLoaded()`.
9. R9 Test hook `POST /api/__test/slow` documented in spec/API.md.

## Acceptance Criteria

- R1: unit — `save` after a fresh sync writes a snapshot with the visible range's items; no write before a fresh answer.
  e2e — scenario 5 "this device keeps a last known calendar".
- R2: unit — moved/deleted item in an older overlapping range is gone after merging the newer range.
- R3: unit — a range 6 weeks back is dropped; an item 30 days ahead is dropped.
- R4: e2e scenarios 1, 3 (offline), 2 (event at 10:00 visible within 5 s while the server takes 10 s).
- R5: e2e scenario 2 (11:00 after the answer); unit — restored item overlapping a fresh range is dropped.
- R6: e2e scenarios 1, 2; note gone after the answer (scenario 2).
- R7: e2e scenario 5; unit — snapshot of another person is not restored; wipe clears the store.
- R8: unit — after restore `items.ranges` is empty.
- R9: API.md row; server unit test that a slowed request waits.

## Testing Plan

- Unit (vitest, jsdom): `web/test/last-known.test.ts` — pure merge/prune, save/restore round trip with the memory
  backend, per-person isolation, wipe, items store restore semantics (`restoredIds`, gc, drop on fresh range).
- Server: test for `/api/__test/slow`.
- e2e: the 5 scenarios on mobile and desktop; `@offline`, `@pwa`, `@signin` sign-out scenarios; `@visual`; goldens.
- Gates: `pnpm --silent verify`, `python3 e2e/scripts/check-steps.py` = 0.

## Implementation Plan

1. Spec + STEPS.md entries + ADR + LikeC4 → verify: check-steps 0 (steps pending implementation), likec4 validate.
2. `web/src/lib/idbStore.ts` (IDB + memory KV) → unit test with memory store.
3. `web/src/stores/lastKnown.ts` pure merge/prune → unit tests (red → green).
4. Items store `restore()` / `restoredIds` → unit tests.
5. lastKnown save/restore/wipe wired to stores; `main.ts` and router guard don't wait when restored; auth wipe on
   sign-out and `/signin` → unit tests.
6. `LastUpdatedNote.vue` + i18n keys → unit test.
7. Server `/api/__test/slow` + API.md → server test.
8. e2e steps; run the 5 scenarios mobile + desktop, then @offline, @pwa, sign-out, @visual, goldens.
   PR boundary: everything above is one reviewable PR (one feature, atomic commits).
