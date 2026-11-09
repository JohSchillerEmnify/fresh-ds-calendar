# Calendar colours

## As Is
The calendar sheet (`CalendarPlanSheet.vue`) only plans when a calendar is off. `PATCH /api/calendars/:id` accepts `hidden` and `defaultReminders`. The colour comes from Google's `calendarList` `backgroundColor`; nothing changes it.

## To Be
The sheet offers the 11 Google colours (same `ColorSwatchPicker` as the event dialog) for every calendar in the person's list, read-only ones included. A pick recolours the calendar's events at once on the device, goes to Google as the person's list colour, and holds on every device.

## Requirements
1. `PATCH /api/calendars/:id` takes `color` (`#rrggbb`) and calls `calendarList.patch` with `colorRgbFormat=true`, `backgroundColor`, and a black/white `foregroundColor`.
2. The sheet shows the swatches with the current colour selected.
3. The change is optimistic and rolled back on refusal (same path as `defaultReminders`: direct write, no outbox).
4. Held events that follow their calendar (`colorId` null, old colour) are recoloured on this device and, via the changed calendar list, on other devices.

## Acceptance Criteria
`spec/features/events/calendar-colours.feature` (e2e), `server/test/calendar-colour.test.ts`, `web/test/device-data.test.ts`, `web/test/calendar-plan-store.test.ts`.

## Assumptions
- Palette = the 11 event colours; a calendar whose colour is not among them shows no swatch selected.
- Per person: Google's calendarList is per account; no server-side copy.
- The hidden tasks calendar is not in the list and not covered.
- Why no outbox: `hidden` and `defaultReminders` writes do not use it either; a colour needs a connection like them.
