# 0025 — Everything lives on the device first and is synced with the server

- Status: proposed (owner, 2026-10-25: "Everything is always stored on the device … only then afterwards will we have
  things on the server")
- Supersedes: the "writes still need the connection" consequence of 0023; the "no device copy" part of 0024
- Views shaped: `web`, `openingWithLastKnownState`, sync

## Context

The app reads and writes through the server, which talks to Google (events, task lists) or keeps per-person files
(settings, themes, templates). 0023 added a read-only snapshot: the last seen days show offline, but every change
still needs a connection, and new kinds of data (templates, 0024) shipped without any device copy. The owner wants the
device to be the place where everything lives, with the server as the place it syncs to, because the same person uses
the browser on one device and the app on a phone.

## Decision

- **Device store.** Every kind of data the app shows (events, task lists and their items, birthdays, settings, prefs,
  categories, calendars, themes, templates, …) is kept per person in IndexedDB on the device. The app always reads
  from the device store; the screen never waits for the server to show data.
- **Writes go to the device first.** A change is applied to the device store at once and put in an outbox. The outbox
  is sent to the server in order as soon as a connection is there; the server writes to Google or its own files and
  answers with the stored version (id, etag), which replaces the device copy.
- **Sync back.** On open, on regaining focus or the connection, and on the existing polling interval, the device asks
  the server for what changed since its last sync and takes in new and changed things it does not have (another
  device, Google Calendar itself).
- **Conflicts.** Each change carries the version it was based on (etag). [OPEN: rule when the server's version moved
  on meanwhile — see Open questions.]
- **Identity.** Things created offline get a device id at once; the server's id replaces it when the outbox entry is
  confirmed, everywhere it is referenced.
- **Per person.** As in 0023: one store per signed-in person; signing out or signing in as someone else wipes it
  (after asking when the outbox still holds unsent changes).
- The service worker keeps never answering `/api` from a cache (pwa.feature); all of this lives in the page.

## Alternatives

- *Keep 0023 (read-only snapshot, writes need the connection)* — rejected by the owner: data must not depend on the
  connection, and new kinds of data keep slipping through without a device copy.
- *A sync library / local-first database (e.g. RxDB, PouchDB/CouchDB, Replicache)* — not chosen: the server of record
  is Google Calendar behind our own API, which none of them speak; we would still write the Google mapping, and they
  bring large dependencies and their own storage formats.
- *Background Sync API in the service worker* — not chosen as the only mechanism: not available in every browser
  (Firefox, Safari) and not in the Android WebView the same way; the outbox is sent by the page, background sync can be
  added on top later.

## Consequences

- Opening and every change are instant and work offline; a small mark shows changes not synced yet. [OPEN: the mark's
  look goes on the design canvas first.]
- The server needs a "changes since" read per kind of data (events via Google's sync tokens; per-person files via
  versions), and every write must be idempotent so a resent outbox entry is not applied twice.
- Reminders scheduled on the device use the device store, so they also work for things created offline.
- A large change in how every feature loads and saves: built in slices (reads for all kinds first, then the outbox per
  kind), each with its scenarios, behind the existing tests.

## Open questions (owner)

1. Conflicts when the same thing was changed on two devices before they synced: last change wins, or keep both and ask?
2. How much is kept on the device: everything, or a window (e.g. a year back and forward) plus all task lists and
   settings?
3. Changes made offline while signed out by expiry: keep them and send after the next sign-in (same person only)?
4. The "not synced yet" mark: where and how it looks (canvas mockup).
