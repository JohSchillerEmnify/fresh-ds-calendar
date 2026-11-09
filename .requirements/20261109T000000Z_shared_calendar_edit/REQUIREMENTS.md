# Shared group calendars are editable

## As Is
`isOwnCalendar` treats every non-primary calendar the person does not own as look-only (owner decision 2026-10-16). Events
in the Google family calendar made by the other member cannot be edited and the calendar is not offered in the picker.

## To Be
A shared group calendar (`…@group.calendar.google.com`) the person may write (role owner or writer) is editable like an own
one: open, edit, move, delete, offered for new events. Another person's own calendar (id = their address) stays look-only.
Invitations unchanged. An event whose organiser e-mail equals its calendar id is the calendar's own event, not an invitation.

## Requirements and acceptance
1. Group calendar + write role => `isOwnCalendar` true (unit: ownership; API: PATCH 200, POST 201, DELETE ok, `own: true`).
2. Person-address calendar with write rights => still look-only "Calendar of …" (existing tests/scenario kept).
3. Organiser = calendarId => no invitation reason (unit).
4. Mock provider gives events inserted into group calendars organiser = calendar (self true).
5. Spec: scenarios in events-readonly.feature, steps in STEPS.md, API.md and c4 wording.

## Testing plan
Unit + API tests in server/test/events-readonly.test.ts (red first), three e2e scenarios, `pnpm --silent verify`.

## Assumptions
- A1 (owner, 2026-11-09 night brief): group id + role owner/writer => editable regardless of `dataOwner`.
- A2: role reader stays look-only. A3: a group calendar's `dataOwner` is ignored on purpose (family calendar data owner is often the creator).
- A4: invitations in group calendars (organiser = a person's address, not the calendar) stay invitations.
