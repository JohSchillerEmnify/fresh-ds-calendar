# Device-first storage, slice 2: changes made offline are kept and sent later (proposed)

Spec: `spec/features/app/offline-changes.feature` (new, `@id:offline-changes`; all `@backlog`). ADR 0025 (accepted),
ADR 0030 (live sync). Builds on slice 1 (`.requirements/20261025T062136Z_device_first_reads`, feature
`last-known-state`). Model: `docs/architecture/models/web.c4` (`outbox`, `outboxSender`), view `sendingOfflineChanges`.
Steps: `e2e/STEPS.md` "Offline changes". Status: spec only, waiting for the owner (spec gate).

Why a new feature file: `last-known-state.feature` is already about 360 lines and is about reading and syncing back;
writing has its own rules (outbox, conflicts, refusals, sessions). The one old scenario there ("Without a connection a
change is not saved yet") described slice 1's limit and contradicts slice 2, so it is removed and the description points
here.

## As Is

- Reads come from the device store (slice 1, built): `stores/device.ts` (`put`, `drop`, `sync`), `stores/sync.ts`
  (triggers open/focus/visible/online/poll/changed, quiet period after a failure, `resyncAfterWrite`).
- Writes go to the server first (`stores/items.ts`): `createEvent`, `updateEvent`, `deleteEvent`, `createTaskList`,
  `updateTaskList`, `deleteTaskList` wait for the answer and then `upsert` it into the cache and the device store.
  Task list item operations and event moves/resizes are optimistic (`optimistic`, `optimisticItem`): shown at once,
  rolled back when the call fails, and the error (network, Google down) goes to the sync banner.
- Deletes wait for their undo time (`pendingDeletes`), then send the request.
- Event and list `PATCH`/`DELETE` send `If-Match: <etag>`; a stale etag answers `412` (`ApiError.isConflict`). Item
  operations send no etag and merge on the server (concurrent ticks from Google and the app merge, API.md).
- A created item has a temporary id until the answer replaces it (`optimisticItem`).
- Offline, every write fails: ticking shows the item ticked for an instant and rolls back with the banner.
- A 401 (expired session) sends the app to the sign-in page; signing in as someone else wipes the device store.
  Sign-out wipes it without asking.

## To Be

Events, task lists and their items (create, edit, move, resize, tick, add/rename/delete/reorder items, delete) are
written to the device store at once and appended to an outbox (IndexedDB, per person, beside the device store). Each
entry holds the change (the fields it touches), the etag it was based on, a client-made key that makes a resend
harmless, and the order number. The outbox sender sends one entry at a time, oldest first, whenever sync would run
(open, focus, visibility, `online`, poll, retry) and straight after a change when online. The server answers with the
stored version (real id, etag), which replaces the device copy; the entry is removed and its mark goes. Entries
still waiting show a "not synced yet" mark; a count of unsent changes is shown too. Where the mark and the count appear
is decided by a design canvas mockup first.

Failures:
- Network, Google unreachable or rate limited, 5xx, or `401` (expired session): the entry stays and is retried; the
  change is never lost, no banner for the failed send itself.
- `412` (the server's version moved on): the change is sent again on the newest etag; the last change wins and only the
  fields it carries change.
- `404`/`400` (deleted elsewhere, validation): the entry is removed, the device copy goes back to what the server has,
  and a persistent notice tells which change was not saved and why. Entries that depend on it (a tick in a list that
  no longer exists) are refused the same way; independent entries after it are still sent.
- Offline-made ids: an item created offline has a device id; later entries for it use that id; when the create is
  confirmed the real id replaces it in the device store, the views, the open dialog/expanded state and every later
  outbox entry.

People: the outbox is kept per person. An expired session keeps it; it is sent after the same person signs in again.
Signing out, or another person signing in, with unsent changes asks first and then deletes them (or, going back, keeps
them for the person they belong to). Nothing of one person is ever sent under another.

Live sync: nothing changes; a sent change publishes a nudge and other open apps fetch it (ADR 0030).

## Requirements

- R1 Write to the device first: a change appears in every view at once, offline or online, and is stored in the
  device store.
- R2 Outbox: every change is appended in order to a persistent per-person outbox; survives reload, closing the app and
  an expired session.
- R3 Sending: entries are sent in order, one at a time, on open, focus, visibility, `online`, the poll and right after
  the change when online; the answer replaces the device copy and removes the entry.
- R4 Mark and count: an unconfirmed entry's item is marked "not synced yet"; the count of unsent changes shows while
  there are any; both disappear when sent.
- R5 Idempotence: a resent entry is never applied twice (server side key, API.md).
- R6 Conflicts: on a stale version the entry is resent on the newest etag (last change wins, only touched fields
  change); ticks of different items and changes to different fields of one item both survive; a deletion wins over an
  edit; an edit of something deleted elsewhere is refused (R7).
- R7 Refusals: a refused change is undone on the device and reported by a persistent notice naming the entry and the
  reason; it does not hold back later independent entries; no silent loss.
- R8 Identity: device ids for things created offline are replaced by the server's, everywhere, including later outbox
  entries, without moving or collapsing what is shown.
- R9 Sessions and people: as above; the outbox is never sent under another person; signing out or another person
  signing in with unsent changes asks first.
- R10 Deletes enter the outbox when their undo time is over, not before; an undone delete sends nothing.
- R11 Live: other open apps show a sent change within about a second (unchanged ADR 0030).

## Acceptance Criteria

Each scenario of `offline-changes.feature` is the acceptance criterion of the requirements it names:
R1/R3/R4: "Ticking an item offline ..."; R2: "... still there ... after the app opens again offline", "The app closed
before the changes were sent ..."; R3 order: "Several changes ... in the order ..."; R1-R4 per kind: the event
create/edit/delete and task list create/edit/delete scenarios; R10: "Deleting an event offline ...", "A deletion
undone within the undo time ..."; R8: "A task list created offline can be changed before it was ever sent ...";
R6: the first four of rule 2; R7: "A change to something deleted elsewhere ...", "A change the server refuses ...",
"A refused change does not hold back ..."; R9: the four `@signin` scenarios; R11: the last scenario. Unreachable
Google: "An unreachable Google keeps the change ...".

## Testing Plan

- Unit (Vitest, `web/test`): outbox store (append, order, persistence across a reload, per-person); sender (send
  order, retry on network/5xx/401, resend on 412, remove and undo on 400/404, dependent entries, id replacement in
  later entries); coalescing is NOT done (sent as made). Server (`server/test`): idempotency key replay answers the
  first result; `If-Match` unchanged.
- e2e (targeted, mobile project, `--workers=1`): the scenarios, a few at a time per PR (`pnpm e2e:affected`); never
  the whole suite. Looks: the mark and the count are looked at in screenshots at phone size once the mockup is agreed.
- Failure injection: `POST /api/__test/refuse-next-write` (new test hook), the existing Google unavailable hook, and
  clearing cookies for the expired session.

## Implementation Plan

Sequential PRs (each independently mergeable, no stacking); each starts with its tests (red), then code, `pnpm verify`.

1. PR A, outbox core + task list item ticks and edits: outbox store and sender in `web/src/stores`, server idempotency
   key (API.md), mark and count (after the mockup), scenarios of rule 1 for items, "app closed", "unreachable
   Google". Test: unit tests of outbox and sender; e2e of those scenarios.
2. PR B, events: create/edit/move/resize/delete through the outbox, delete after undo time, 412 resend. Test: unit +
   the event scenarios and the first two of rule 2.
3. PR C, task lists: create/edit/delete, device ids replaced everywhere (items store, dialog, later entries). Test:
   unit for id replacement + the task list scenarios.
4. PR D, refusals and two devices: persistent notice, undo on the device, test hook, the last-change-wins and refusal
   scenarios, the live-sync scenario.
5. PR E, people: expired session keeps the outbox, sign-out and another person ask, wipe or keep. Test: unit + the four
   `@signin` scenarios.
Later slice (not here): settings, prefs, theme, own themes, templates, Canvas areas, sharing and the other kinds.

## Decisions (proposed, to confirm)

- D1 Last change wins = the change that reaches the server last, applied on top, only the touched fields. Alternatives:
  order by the time of making (needs trustworthy device clocks, which phones lack); whole-item overwrite (loses the
  other side's unrelated fields; Google's own PATCH semantics already merge). Assumption: the owner's "as in Google
  Calendar itself" means this.
- D2 A refused change is undone and reported, not retried forever, so one bad entry cannot block the outbox. Alternative:
  stop the outbox and ask (blocks all later changes; worse for a phone).
- D3 A failed send because of the network is silent (the mark says it); the existing banner stays for sync failures.
- D4 Nothing is coalesced: entries are sent as made, in order (simple and exact; a tick, untick pair is two writes).
  Alternative: merge entries per item (fewer requests, more rules). Assumption: simplest that is correct.
- D5 No library: the outbox is a small IndexedDB list beside the device store, since the server is Google behind our API
  (ADR 0025 alternatives). Background Sync stays a later addition.
After the owner agrees, D1-D4 become a short ADR (0031) or an addendum to 0025.
