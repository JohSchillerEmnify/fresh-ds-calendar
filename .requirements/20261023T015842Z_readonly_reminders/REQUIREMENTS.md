# Reminders on read-only calendars

Owner request (2026-10-23): "You should be able to adjust the reminders even on read-only calendars. The calendar itself
of course is not changed, but the way it is integrated into Google, it should be saved."

## Research (checked 2026-10-23)

- Google `events.reminders` is "information about the event's reminders for the **authenticated user**"; changing it does
  not change the event's `updated`. Per-calendar defaults are `calendarList.defaultReminders` ("the default reminders that
  the authenticated user has for this calendar"), also user-specific metadata.
- The docs do **not** say whether a user with only `reader` access may `events.patch` the `reminders` of an event. In
  practice `events.patch` needs write access to the calendar (403 `forbidden` otherwise); whether Google makes an
  exception for the per-user field cannot be settled from the docs. Hence two paths, decided at runtime by Google's answer.
- Existing code: `CalendarService.updateEvent` refuses every change of a read-only event (403 `calendar.event.notOwn`)
  before it looks at reminders; the read-only dialog shows no reminders; `GoogleProvider` maps every 403 to
  `ProviderUnavailableError` (503), so "refused" cannot be told from "down". The client builds the push / snackbar /
  Android reminder plan from `item.reminders` of the items the server returns, so reminders that the server puts into
  `item.reminders` ring everywhere without client changes.

## As Is

Events the person cannot edit (reader / freeBusyReader / not-own calendars, invitations of others) open read-only; their
reminders can neither be seen nor changed in the dialog; the server refuses any PATCH of them.

## To Be

In the read-only dialog the reminders (and only they) can be changed. Changes apply at once (no save button; the dialog
has none). The server first PATCHes only `reminders` in Google. If Google refuses (403), the person's reminders for that
event are kept in the app's own per-person file and applied whenever the event is read. Which path worked is remembered
per calendar. Everything else in the event stays look-only (PATCH with any other field: 403 as before).

## Requirements

- R1 In the read-only event dialog the reminders row (chips, add, remove, calendar default, none) is shown and editable;
  title, time, location, description, calendar and colour stay look-only; there is still no save / delete button.
- R2 `PATCH /api/events/:id` whose body contains only `reminders` is allowed for a read-only ordinary event; a body with
  any other field stays 403 `calendar.event.notOwn`.
- R3 The server tries `events.patch {reminders}` (no other field, no `If-Match`) first. A Google 403 on that call (new
  `ProviderForbiddenError`) stores the override instead; any other provider error is passed on unchanged (503 etc.).
- R4 Overrides live in `DATA_DIR/users/<sub>/reminder-overrides.json` (`paths`: calendarId -> `google|local`; `events`:
  calendarId -> eventId -> `{useDefault, minutes}`), part of the Drive backup like every file under `users/<sub>/`.
- R5 `toEvent` of a read-only event applies the override, so GET/`items` show it and the plan rings from it.
- R6 The path per calendar is remembered: `local` skips the Google attempt; `google` is tried first (and falls back to
  `local` + records it if Google refuses later). A successful Google write deletes the event's override.
- R7 The mock provider refuses `events.patch` that carries only `reminders` on reader / freeBusyReader calendars by
  default, switchable by a test route (`PUT /api/__test/remote/reader-reminders {allow}`), reset by `__test/reset`.
- R8 Not in scope: birthdays / the contacts calendar (their dialog keeps no reminders row), task lists, shared lists,
  calendar default reminders of read-only calendars (already 403 `reminders.readOnly`; the owner asked for events).

## Acceptance Criteria

- AC1 (R1) e2e: in the read-only dialog "I add the reminder" works, the dialog stays read-only without save/delete.
- AC2 (R2) unit: reminders-only PATCH 200 on reader-calendar event; title+reminders 403; invitation in own calendar too.
- AC3 (R3) unit: allow mode -> Google event has the reminders, no override file entry; refuse mode -> Google unchanged,
  override stored; outage (503) -> 503, nothing stored.
- AC4 (R4) unit: file content; backup contains it (it is under `users/<sub>/`, covered by the existing walk - asserted).
- AC5 (R5) unit: GET after refuse shows override minutes; e2e: ring + after reload.
- AC6 (R6) unit: with path `local` no Google patch call is made (counter on mock); Google success deletes override.
- AC7 (R7) unit: mock refuses on reader, accepts on writer, accepts after allow.

## Testing Plan

Server vitest (`server/test/reminders-readonly.test.ts`), then e2e scenarios below (mobile + desktop), then
`pnpm --silent verify`, `check-steps.py`, likec4 validate.

## Implementation Plan

1. Spec scenarios + STEPS.md + steps (red). 2. Server unit tests (red). 3. `ProviderForbiddenError` + Google mapping +
mock refusal + test route. 4. `ReminderOverrideStore` + service branch + `toEvent`. 5. API.md + LikeC4. 6. Web dialog.
PR boundary: the whole branch (one reviewable unit).

## Assumptions (owner to confirm)

- A1 No save button: the read-only dialog has none (scenario "no save or delete button"), so each change is sent at
  once, optimistic with rollback like other writes.
- A2 Override per event instance id (a recurring series' instances each need their own change).
- A3 The per-calendar path record lives in the same file as the overrides, not in prefs.json.
- A4 "Invitation" events in the person's own writable calendar use the same code; Google normally accepts them.
- A5 Old overrides are not pruned (a few bytes per touched event).
- A6 Email reminders are untouched on the Google path (kept like for own events); overrides carry popups only.
- A7 Birthdays are left out (R8).
