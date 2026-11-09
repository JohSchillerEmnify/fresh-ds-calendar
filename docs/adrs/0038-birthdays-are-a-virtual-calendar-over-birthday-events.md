# 0038: Birthdays are a virtual calendar over birthday events

Status: accepted (owner decision, issue 59)

## Decision

The app lists one calendar of its own, `birthdays` ("Birthdays", `virtual: true`), next to the person's Google calendars. It
holds every event with `eventType: "birthday"` (any `birthdayProperties.type`) from any of the person's calendars, plus the
events of Google's old contacts calendar (`addressbook#contacts@...`) even when Google marks it hidden. That contacts
calendar is read but never listed. These events carry `calendarId: "birthdays"` (and `sourceCalendarId`, the real one, which
the change feed's per-calendar bookkeeping uses). The calendar's switch is the existing per-person `hidden` flag, so plans,
the widget's `excludeHidden` and every web reader work unchanged (ADR 0037). Its colour is the person's choice, stored in
`prefs.json` (Google has no list entry for it). A birthday seen twice (same contact and kind, else same title, on the same
date) is shown once, the editable copy first. Editing and creating are unchanged. The server logs the anonymised
`calendar_shape` line once per person and day, to show where a missing birthday is.

## Alternatives

- **Keep following the holding calendar (before):** birthdays switched and coloured with "Personal". Since 2025 Google's API
  has no separate Birthdays calendar, so the app could not give them their own switch like Google Calendar does.
- **Mirror Google's "Birthdays" view setting (tick box, "Sync from Contacts"):** the API does not expose it; a second switch
  in the app would be a guess.
- **A client-only filter by `special`:** the server's `excludeHidden`, the widget and the plan scheduler would each need to
  learn it, against ADR 0037's single `hidden` source.

## Why this won

One flag, one colour, one list entry for every reader, with no new rule to evaluate; and it follows Google Calendar's own
model (birthdays as a calendar-like view over events). Cost: the event's `calendarId` is no longer its Google calendar, so
the change feed's removals and replaces use `sourceCalendarId`, and the dedupe runs on both the server and the device.
