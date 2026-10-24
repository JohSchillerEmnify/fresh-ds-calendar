# Repeating task list: "This week / All weeks" when the list or its items are changed

Owner decision (2026-10-24): editing a repeating (weekly) task list — renaming it, adding an item, changing an item's
text, removing an item — asks "This week / All weeks", the way Google does for repeating events. Ticking stays per week
(2026-10-23: the first tick splits that week off as an exception; merge 4c4ca87).

## Research (done before the design)

### In the app

- No "this / all" choice exists anywhere in the app. Repeating Google events: changing one occurrence changes only that
  occurrence (events-display.feature, Rule "An event repeating in Google ..."); birthdays always change the whole series
  (API.md). So the choice is new UI; it takes Google's shape and wording ("This event / All events" → owner's "This week /
  All weeks").
- The only dialog of the kind is `ConfirmDialog` (`confirm-dialog`, two buttons). The new choice is built the same way
  (`AdaptiveSheet`, same title/actions layout), with Google's radio list + OK.

### Google Calendar API (checked 2026-10-24)

1. Changing the whole series = updating the recurring event (master): "Recurring event modifications can either affect the
   whole recurring event (and all of its instances), or only individual instances. Instances that differ from their parent
   recurring event are called exceptions."
   https://developers.google.com/workspace/calendar/api/concepts/events-calendars (section "Instances and exceptions").
2. Exceptions keep their own changes when the master is updated: "Individual events in a series may be changed, or even
   deleted. Such events become exceptions: they are still part of the series, but changes are preserved even if the
   recurring event itself is updated." — Google Calendar API team, "Calendar API v3 Best Practices: Recurring Events"
   https://gsuite-developers.googleblog.com/2011/12/calendar-v3-best-practices-recurring.html (its editor's note: the call
   that reverted an instance to the series was deprecated — there is no "reset exception").
3. Google warns against changing every instance one by one for a whole-series change: "Do not modify instances
   individually when you want to modify the entire recurring event ... This creates lots of exceptions that clutter the
   calendar" https://developers.google.com/workspace/calendar/api/guides/recurringevents
4. An exception is changed like any instance (`events.patch` on its id) — same guide, "Modify or delete instances".
5. Finding the exceptions: `events.list` without `singleEvents` "only returns single events, recurring events, and
   exceptions" (recurringevents guide, "Access instances"); `showDeleted=false` leaves out cancelled ones
   (https://developers.google.com/workspace/calendar/api/v3/reference/events/list). An exception carries
   `recurringEventId` = the master's id ("Immutable", events resource reference).
6. Not documented: whether a master update also reaches fields an exception never changed itself (e.g. the title of a
   week that was only ticked). Google's docs and the blog say nothing more; I found no official statement either way.

### What this means for "All weeks"

- Weeks that are still plain instances follow the master by themselves (1).
- Weeks already split off (by a tick, or a "This week" change) keep their own data when only the master changes (2): with
  a master update alone, a rename would NOT reach them reliably (6). So "All weeks" = patch the master **and** patch each
  existing exception with the same change (4, 5). Exceptions already exist, so this creates no new exceptions (3 is
  respected: unmodified weeks are never patched one by one).
- Each exception is changed by a read-modify-write of its own data with the change applied by item id, so its ticks stay.
  The result is the same whether or not Google itself propagates unchanged fields (6) — the second write is then a no-op
  for that field.
- Nothing needed is impossible in Google: every call (events.get / patch / list) is a documented, already used call. No
  workaround or retry around a failing call is needed.

## As Is

- A range read lists every week of a repeating list under its occurrence id (`seriesId` = Google `recurringEventId`).
  Every change the UI makes is addressed to that occurrence id, so it changes this week only (Google exception).
- `PATCH /api/tasklists/:id` and the item ops address exactly the id given (item ops on the series id go to the first
  week). There is no way to change all weeks from the UI.

## To Be

- On a repeating list (the shown list has a `seriesId`), these changes first ask "This week / All weeks"
  (daily lists: "This day / All days"; monthly: "This month / All months"):
  - renaming the list (in place in the list sheet, or in the task list form),
  - adding an item, changing an item's text, removing an item.
- Ticking/unticking, reordering, date, time, estimate, category, reminders and the door switch never ask (this week only,
  as today).
- "This week" does exactly what the app does today (the occurrence id, an exception from then on).
- "All weeks": the server changes the series (master) and every week already split off (exception); weeks that are not
  split off follow the master. Past weeks are included, as Google's "All events" (owner's words: "all weeks").
  Each split-off week keeps its ticks; an item added for all weeks arrives unticked everywhere.
- Cancel (or closing the choice) changes nothing: the edited text goes back (an added item's text returns to the add field).
- One-off lists and shared lists never ask.

## Requirements

1. R1 — API: `?scope=all` on `PATCH /api/tasklists/:id` (body: `title` only), `POST /api/tasklists/:id/items`,
   `PATCH /api/tasklists/:id/items/:itemId` (body: `title` only) and `DELETE /api/tasklists/:id/items/:itemId` applies the
   change to every week of the series the id belongs to (an occurrence id or the series id). The answer is the addressed
   list (same id) after the change. Without `scope` (or `scope=this`) behaviour is unchanged.
2. R2 — "All weeks" patches the master once, then every non-cancelled exception of the series (found by `events.list`
   without `singleEvents`, `recurringEventId` = series id), each by read-modify-write with the change applied by item id.
   Ticks (`done`) and `completedOn` rules of each week are kept/recomputed as for any write.
3. R3 — Add item for all weeks: one new item id, appended (or at `index`) unticked in the master and in every exception.
   Change text: every week holding that item id gets the new text, `done` unchanged. Remove: removed from every week
   holding it. Rename list: every week gets the title. A week that does not hold the item is left as it is.
4. R4 — Validation: `scope=all` on a list that does not repeat (one-off or shared) → 400 `This list does not repeat`
   (field `scope`); `scope=all` with other fields than `title` on `PATCH /api/tasklists/:id`, or with `done` on an item
   patch → 400 (field `scope`); an unknown `scope` value → 400. Unknown item on the addressed list → 404 as today.
5. R5 — Web: the choice ("This week" preselected, OK, Cancel) appears for the changes in To Be on a list with `seriesId`,
   and only there. "All weeks" sends `scope=all`; afterwards the visible range is reloaded so the other weeks show the change.
6. R6 — Web form: when the title changed on a repeating list, the form asks on save. "All weeks": the title goes to all
   weeks; the other changed fields of the form still go to this week only (sent first, with the form's etag). "This week":
   unchanged single save.
7. R7 — Remove item for all weeks keeps the undo time: the choice comes first, then the item hides with the undo snackbar;
   the request (with `scope=all`) goes when the undo time is over; undo changes nothing anywhere.
8. R8 — Wording: en "This week" / "All weeks" (daily: "This day" / "All days", monthly: "This month" / "All months"),
   title "Change repeating list"; de and the dialects get translations.

## Acceptance Criteria

- AC1 (R1, R3): weekly "Clean" since 2026-10-14 (Sink, Floor). Add "Mirror" with `scope=all` via the 2026-10-21 id →
  200, answer id = that id, items Sink, Floor, Mirror; range read: every week (10-14, 10-21, 10-28) has `Sink:0,Floor:0,Mirror:0`.
- AC2 (R2): week 10-14 ticked (Sink) before; rename for all weeks via 10-21 → every week titled "Bathroom", 10-14 still
  `Sink:1`; the master's title is "Bathroom".
- AC3 (R3): change item text "Sink" → "Basin" for all weeks with 10-14 ticked → `Basin:1` on 10-14, `Basin:0` elsewhere.
- AC4 (R3): remove "Floor" for all weeks with 10-14 split off → no week holds Floor.
- AC5 (R3): an item added "this week" to 10-21 only, then renamed for all weeks → only 10-21 changes; the master is unchanged.
- AC6 (R4): `scope=all` on a one-off list → 400; with `date` in the body → 400; item patch `{done:true}` with `scope=all` → 400;
  `scope=everything` → 400.
- AC7 (R1): without `scope` the existing tests stay green (this week only).
- AC8 (R5–R7, e2e): the scenarios in `spec/features/task-lists/tasklists-repeating.feature` pass on mobile and desktop.
- AC9 (R5): one-off lists never show the choice (existing item/rename e2e scenarios stay green; web unit test).

## Testing Plan

- Server (vitest, mock Google, `server/test/tasklists.test.ts`, new describe "recurring task lists: all weeks"): AC1–AC7,
  written first and seen red.
- Mock Google: `listEvents({ singleEvents: false })` returns stored events without expansion (masters + exceptions +
  one-offs), as Google (unit-covered by the server tests above).
- Web (vitest): `ops.ts` sends `scope=all` and never merges an all-weeks patch with a tick; the API client adds
  `?scope=all`; the choice helper resolves this/all/null.
- e2e (targeted, `--grep` the new scenario names) on mobile and desktop; the existing item scenarios of
  `tasklists-items.feature` that touch add/rename/delete and the adhd-support weekly scenario as regression.
- @visual: no new baseline may be written (no `--update-snapshots`), so the dialog gets no snapshot scenario; the existing
  @visual scenarios are run, and the new dialog is screenshotted at phone size (375x812) and looked at.
- `pnpm --silent verify`, `python3 e2e/scripts/check-steps.py` = 0.

## Implementation Plan

1. Spec: `tasklists-repeating.feature` + STEPS.md + step code; check-steps 0. API.md: `scope`. (No LikeC4 change: no new
   component or relation — the web list view and the server's task list service already talk; ADR not needed: the
   decision is recorded here and in API.md.)
2. Server tests red → provider `singleEvents` option (mock + Google) → `CalendarService.forAllWeeks` + routes → green.
3. Web: client `scope`, ops scope, `RepeatScopeDialog.vue` + `useRepeatScope`, wiring in `TaskListView.vue`,
   `TaskListDialog.vue`, `pendingDeletes`; i18n. Unit tests first.
4. e2e targeted + @visual run + phone screenshot of the dialog.
   **PR boundary**: one PR (spec + server + web), it does not split into independently useful parts.

## Assumptions (owner can overrule)

- A1: "All weeks" includes past weeks (Google's "All events" does; owner said "all weeks"). A past week that was finished
  shows the new item unticked (it is no longer complete). Alternative "This and following weeks" was not asked for.
- A2: Only the four changes the owner named ask. Reorder, date/time, estimate, category, reminders, door tag stay this week.
- A3: In the form, "All weeks" applies only the title to all weeks; the other changed fields of the same save go to this
  week (A2). One request per scope.
- A4: Adding several items in a row asks for each one (as Google asks for every edit).
- A5: An item that exists only in some weeks (added "this week") is changed for all weeks only where it exists.
- A6: Cancel discards the change (Google: the edit is not saved); for "add" the typed text returns to the add field.
- A7: If a write fails midway (e.g. Google unavailable after the master was patched), the answer is the error; the change
  may be on some weeks only. Repeating the same change is safe (rename / text / remove are idempotent; add creates a
  second item). No automatic retry is added beyond the existing 412 re-read.
- A8: Daily and monthly lists ask with "day" / "month" wording (the owner named weekly; same mechanism).

## Owner review 1 (2026-10-24) — supersedes the "All weeks" parts above

- A1 rejected (owner: "google has all events, just this or all FUTURE (from this point on!) tbh past with task list does
  not make a lot of sense"). Wording (owner): "This task list" / "This and all following task lists" for every rhythm
  (A8 dropped); de "Diese Aufgabenliste" / "Diese und alle folgenden Aufgabenlisten". API: `?scope=following`.
- Google research for "this and following": the Calendar API has no such operation and documents none; the recurring
  events guide only warns not to do it by changing instances one by one
  (https://developers.google.com/workspace/calendar/api/guides/recurringevents). Google Calendar's UI does it by splitting
  the series (old series ends, a new one starts with the change) — third-party descriptions, not Google docs
  (https://github.com/ncukondo/gcal-cli/issues/72, https://note.com/gws_riko/n/n96c5fa216410?hl=en). What Google does with
  exceptions after a new `UNTIL` is undocumented, so the server never relies on it.
- Chosen: the split, built only from documented calls (events.patch / insert / delete / list, RRULE `UNTIL` per
  RFC 5545, `recurrence` is writable): (1) the shown occurrence gets the change (keeps its id: the client's view stays
  valid); (2) a new series from the next live occurrence (found by a 62-day range read; DTSTART must be a real rule date,
  monthly rules with gaps included) with private `series` = first series' id; (3) later exceptions (incl. cancelled,
  `showDeleted`) carried to the new series' occurrence of the same rule date with their own data + change, old exception
  deleted explicitly; (4) old series gets `UNTIL` = shown occurrence's start last (a failure midway leaves duplicates, never
  a gap). From the first occurrence nothing is split (series + exceptions, as before). Alternatives rejected: freezing
  every past plain week as an exception (Google warns against clutter); versioned data inside one master (Google
  Calendar itself would then show the new title on past weeks).
- Consequences handled: `seriesKey` (= `series` property, else `seriesId`) groups the parts on the door; deleting a series
  deletes its later parts; a later write of the old master keeps its `UNTIL` (codec keeps a same-rhythm rule).
- Review fixes (code-reviewer): form retry after a failed title request sends only the title with the new version; removing
  an item still being added asks and passes the answer; a this-only rename never merges ahead of a following one; the
  question is cancelled when the list view goes away. Deferred: the server re-saves lists that do not hold the item
  (harmless, new etag only); a second question cancels an open one (not reachable through the modal).
