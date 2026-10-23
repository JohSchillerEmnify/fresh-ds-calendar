# Weekly task list: each week is ticked on its own ("split on first tick")

Owner decision (2026-10-23, night brief): **Split on first tick** — ticking (or otherwise changing the items of) an
occurrence of a repeating task list turns that occurrence into its own exception instance, as Google does for an edited
occurrence (`events.patch` on the instance id), so the other weeks stay unticked. This includes the first occurrence
(the master's own date): it must become an exception, not change the master's items.

## As Is

- A repeating list is one Google event with `recurrence` (the master). Its items (with done flags) live in
  `extendedProperties.private`. Google (and `MockGoogleProvider`) expand unmodified instances by copying the master,
  items included.
- A range read (`GET /api/items`, Google `singleEvents=true`) lists every occurrence under its instance id
  (`<masterId>_<YYYYMMDD>`), including the first one. An item op on an instance id patches the instance, which becomes
  an exception (mock: `doPatch` materialises it; Google: patching an instance creates an exception). This already works
  (server test "daily recurrence: instances have their own ids and ticks").
- `POST /api/tasklists` and `GET /api/tasklists/:masterId` answer with the **master** id. An item op on the master id
  (`TaskListService.modify` → `patchEvent(masterId)`) writes the master's items, so every unmodified week shows the tick.
  Reproduced by a throwaway server test: tick via the create answer's id → 2026-10-14 and 2026-10-21 both `1/2`; via the
  listed id → `1/2` and `0/2`.
- e2e evidence (main code, before the fix): the adhd-support scenario **passes** on mobile — `I open the day view` is a
  page load, so the client only ever holds the listed occurrence id. A trial scenario "tick right after creating it, no
  reload" also passed on main (a sync refresh replaces the create answer before the tap in the test), so the UI path is
  a race (create answer held until the next refresh), not reproducible by e2e; that trial scenario was dropped as
  non-discriminating. The KNOWN-FAILURES entry was stale; the API bug is real (server test above).

## To Be

- Item ops (tick/untick, rename an item, add, delete, reorder) never change the master's items. Addressed to the master
  id, they go to the master's **first occurrence** (the instance on the master's start day, as a range read lists it),
  which becomes (or already is) an exception. The answer is that occurrence (its own id).
- Item ops on an occurrence id: unchanged (that occurrence only).
- Creating a repeating list answers with its first occurrence (the id range reads list), so the client never holds the
  series id (closes the race above; one extra read of the start day per repeating create).
- Edits of the list itself (`PATCH /api/tasklists/:id`: title, date, time, category, items replacement by the form) and
  `DELETE /api/tasklists/:id` keep addressing exactly the id given — the master id edits / deletes the series (owner:
  "leave master edits as they are"), an occurrence id that occurrence.

## Requirements

1. R1 — An item op addressed to a repeating list's master id is applied to the first occurrence, never to the master.
2. R2 — Unticking (or any later item op) on an occurrence that was split off keeps it an exception; it is not merged
   back into the series, and the other weeks are not touched.
3. R3 — Renaming, adding, deleting and reordering items behave like a tick (same split).
4. R4 — Timed repeating lists behave the same.
5. R5 — List edits (`PATCH /api/tasklists/:id`) and deletes keep their current addressing (series via master id).
6. R6 — One-off lists are unaffected.
7. R7 — If the first occurrence no longer exists on its day (deleted, or moved to another day), an item op on the
   master id answers 404 (nothing of that week to change).
8. R8 — `POST /api/tasklists` with a `recurrence` answers with the first occurrence (same id as a range read), still a
   plain instance (no exception is created by the create).

## Acceptance Criteria

- AC1 (R1): weekly list on 2026-10-14 with Sink, Floor; tick Sink via the master id → answer `date 2026-10-14`,
  `doneCount 1`, id ≠ master id; range read: 2026-10-14 `Sink:1,Floor:0`, 2026-10-21 `Sink:0,Floor:0`; master's stored
  items all not done; the answer's stored event has `recurringEventId = master id`.
- AC2 (R2): tick then untick via the master id → both answers have the same occurrence id; both weeks unticked; the
  stored occurrence is still an exception.
- AC3 (R3): rename / add / delete / reorder via the master id change only 2026-10-14.
- AC4 (R4): the same with `time 09:00`.
- AC5 (R5): `PATCH /api/tasklists/:masterId` with a new item list changes every week; answer id = master id.
- AC6 (R6): a tick on a one-off list answers with the same id.
- AC8 (R8): create weekly → answer id = id listed for 2026-10-14, `recurrence weekly`, no stored exception; a tick
  through it splits only that week.
- AC7: e2e adhd-support "A weekly task list repeats and each week is ticked separately" green on mobile and desktop.

## Testing Plan

- Server integration tests (vitest, mock provider, `server/test/tasklists.test.ts`, describe "recurring task lists: an
  item change splits off the occurrence"): AC1–AC6, written first and seen red (4 red, the two "unchanged" ones green).
- e2e: the adhd-support scenario (already covers "ticking the first week leaves the other weeks unticked": it ticks on
  2026-10-14, the master's own date) on mobile and desktop; targeted @tasklists scenarios around ticking.
- `pnpm --silent verify`, `python3 e2e/scripts/check-steps.py` = 0.

## Implementation Plan

1. Tests (red) → `TaskListService.modify` gets an `occurrence` flag; item ops set it; a master target is resolved to its
   first occurrence by a range read of the master's start day (`listEvents`, finds `recurringEventId === master.id`) —
   works for Google's real instance ids (all-day `_YYYYMMDD`, timed `_YYYYMMDDTHHMMSSZ`) without building them; the
   patch goes to `cur.id`. Verify: server tests green.
2. Test (red) → create answers the first occurrence (`firstOccurrence(ev)`). Verify: server tests green.
3. API.md: document the addressing. KNOWN-FAILURES.md: remove the entry once e2e is green.
   **PR boundary**: one PR (server fix + docs + test).

## Assumptions / decisions not settled by the owner

- A1: the first occurrence is found by listing its day; a first occurrence moved to another day → 404 (R7), rare edge.
- A2: master edits keep editing the series. The UI offers no "for all weeks" edit: the form never sends `recurrence` on
  edit and only ever holds occurrence ids (now also right after a create), so a form edit changes that occurrence —
  as it already did after any reload. Edits for all weeks would need a new owner decision.
- A3: deleting an occurrence id deletes only that occurrence (cancelled exception), deleting the master id the series —
  unchanged.
- A4: after the split, later changes of the series (title etc.) do not reach the split-off occurrence in the mock;
  Google's own propagation rules apply on real Google. Not changed here.
- No LikeC4/ADR change: no new component or cross-cutting decision; the provider contract (patching an instance makes
  an exception) is already in API.md.
