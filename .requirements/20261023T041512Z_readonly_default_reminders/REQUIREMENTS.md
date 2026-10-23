# Default reminders of read-only calendars

Owner request (approved 2026-10-23, night run): in Settings → Reminders the default reminders of read-only calendars become
editable, like the per-event reminders of read-only events (20261023T015842Z_readonly_reminders, whose R8 excluded exactly
this). The approved scenarios are in `spec/features/events/reminders.feature`.

## As Is

- `CalendarService.setDefaultReminders` throws `403 reminders.readOnly` for a calendar without writer/owner role.
- `RemindersView.vue` shows a read-only calendar's defaults without add/remove (`ReminderEditor :readonly`) and a note
  "Read-only calendar".
- `reminder-overrides.json` (per person) keeps only per-event reminders of read-only events plus a per-calendar path
  (`google` / `local`, `local` expiring after `LOCAL_PATH_TTL_MS` = 24 h).
- The mock provider accepts `calendarList.patch` defaults on every calendar; its reader policy
  (`PUT /api/__test/remote/reader-reminders`) covers only `events.patch` with nothing but `reminders`.

## To Be

`PATCH /api/calendars/:id {defaultReminders}` on a read-only calendar goes to Google first (`calendarList.patch`, the
defaults are per person in Google). Only a permission 403 (`ProviderForbiddenError`) makes the app keep the popup list
itself in `reminder-overrides.json` (`defaults`: calendarId -> `{ minutes, since }`); within a day of that refusal Google is
not asked again, after a day it is. Every read of the calendar list (GET calendars, items, the event dialog's default,
the reminder plan on web push / Android / snackbar, which are built from `item.reminders`) sees the kept list as the
calendar's popup defaults. Settings show read-only calendars editable, without the note.

## Assumptions (approved, A1-A5 from the owner's brief; D1-D3 decided here)

- A1 Google first; only `ProviderForbiddenError` (not quota/outage) falls back; local path re-tried after a day.
- A2 Popup only; email (other) defaults in Google are untouched and still count toward the 5 in Google's list.
- A3 Only the person's own reminder data; never the owner's calendar or events.
- A4 Same limits as before (`defaultRemindersSchema`: ≤5, unique, 0-40320).
- A5 An event's own reminders (Google's or kept by the app) win over the calendar default.
- D1 The "which way worked" memory for defaults is separate from the events' per-calendar path: Google may accept
  `calendarList.patch` (per-user list entry) while it refuses `events.patch` on the same reader calendar, so one refusal
  must not block the other. Represented as the presence + `since` of the `defaults` entry.
- D2 Kept defaults apply only while the calendar is still read-only (no writer/owner role), like the event overrides that
  apply only to read-only events; when Google later accepts, the kept entry is dropped (Google is the source again).
- D3 The mock's existing reader-reminders switch covers both `events.patch` reminders and `calendarList.patch` defaults on
  reader / freeBusyReader calendars (one switch; the scenarios' wording "Google accepts reminder changes in calendars I
  can only read" covers both). Default stays "refuse".

## Requirements

- R1 `setDefaultReminders` on a read-only (non-tasks) calendar no longer throws 403; it follows A1.
- R2 Kept defaults are stored in `reminder-overrides.json` under `defaults[calendarId] = { minutes, since }` (Drive backup
  like the rest of the file); a Google success deletes the entry.
- R3 `providerCalendars()` overlays kept defaults on read-only calendars (popups replaced, other methods kept), so GET
  `/api/calendars`, the PATCH answer, `/api/items` and `GET /api/events/:id` use them.
- R4 Writable calendars are unchanged (Google only, errors passed on).
- R5 Mock: `setCalendarDefaultReminders` on reader / freeBusyReader calendars throws `ProviderForbiddenError` unless the
  reader-reminders switch allows it.
- R6 Web: `RemindersView` drops `:readonly` and the read-only note (and the now unused i18n key).
- R7 Docs: spec/API.md (PATCH calendars, test route), LikeC4 `reminderOverrides` description, ADR addendum if one exists.

## Acceptance Criteria

- AC1 (R1, R5) unit: allow → Google calendar list entry has the new popups, no `defaults` entry; refuse → Google unchanged,
  response and GET calendars show the kept list.
- AC2 (R1) unit: within a day of a refusal no `setCalendarDefaultReminders` call; after a day it is asked again and a
  success drops the entry.
- AC3 (R1) unit: outage → 503, nothing stored; 6 reminders → 400; unknown → 404.
- AC4 (R3, A5) unit: an event on the calendar default shows the kept minutes in items; an event with own reminders keeps them.
- AC5 (R4) unit: existing writable tests unchanged; the old "read-only is 403" test now expects 200.
- AC6 (R6) e2e: the four approved scenarios green (mobile project).

## Testing Plan

Server vitest in `server/test/reminders-readonly.test.ts` (new describe "default reminders of a read-only calendar"),
updated case in `server/test/reminders.test.ts`. Web: existing unit tests stay green (no logic change beyond the template).
e2e: `--grep` on the four new scenario names. Gates: `pnpm --silent verify`, `check-steps.py` 0.

## Implementation Plan

1. Spec: 4 scenarios + new step in STEPS.md, check-steps 0.
2. Docs: API.md, server.c4 (validate), ADR line.
3. Red: server unit tests. Green: mock policy, store `defaults`, `setDefaultReminders` path, overlay. → verify server tests.
4. Web template + i18n. → web tests.
5. e2e steps + targeted run. → PR boundary: the whole slice is one reviewable PR (small; does not split).
