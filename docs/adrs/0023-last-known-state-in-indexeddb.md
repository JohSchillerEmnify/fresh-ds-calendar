# 0023 — The web client keeps the last known state in IndexedDB

- Status: accepted (owner, 2026-10-23: spec `last-known-state` and assumption A1 approved)
- Views shaped: `web`, `openingWithLastKnownState`

## Context

On a bad connection the app waited for `/api/config`, the settings, the theme and the session check before its first
paint, then for the range it shows; offline it opened empty. The owner wants the last known state at once, replaced by
fresh data when the server answers. The service worker must keep never answering `/api` from a cache (pwa.feature),
and one device can be used by different people one after the other.

## Decision

- The page (not the service worker) keeps one snapshot per signed-in person in IndexedDB (`calendar-last-known`): the
  config, settings, prefs, calendars, imported themes and the items of every range it showed within ±4 weeks of today,
  with the time of the last successful update. It is written (debounced) only after fresh answers.
- At start the snapshot of the person last signed in on this device (`cal.lastKnownPerson`) is applied before the first
  route and the app mounts without waiting; the usual loads run behind it. Restored items stay outside the loaded
  ranges, so only fresh data counts as loaded (reminder scheduling, `windowLoaded`).
- Signing out, or reaching the sign-in page at all, wipes the database; a save for one person deletes any other's.
- A hand-written ~40-line wrapper (get, set, clear), no new dependency.

## Alternatives

- *Service worker runtime cache, stale-while-revalidate for `/api`* — rejected: breaks "API requests are never served
  from the service worker cache", the cache is per origin not per person, and a sign-out would have to reach into the
  worker's cache; it also could not show the age of the data or keep only the seen days.
- *localStorage* — rejected: ~5 MB per origin shared with everything else, synchronous writes of a large JSON on the
  main thread at every sync.
- *idb-keyval (dependency)* — not needed for three calls; one more package to keep up to date.

## Consequences

- Offline and on slow connections the last seen days show at once, with a "Last updated HH:mm" note until fresh data
  arrives; days not seen stay empty. Writes still need the connection (nothing is queued).
- A slow server no longer delays the first paint once a snapshot exists; a session that expired meanwhile shows the
  person's own last state for a moment before the sign-in page.
