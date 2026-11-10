# Holiday regions (issue 60)

## As Is
Holiday calendars show only if the person subscribed in Google itself. The app has no way to add or remove one.

## To Be
Settings › Calendars › Holidays lists the subscribed holiday calendars (switch and colour like any calendar) and an "Add region" row that
opens a searchable picker of countries (names in the app language). Adding is `calendarList.insert`, removing `calendarList.delete`.
Spec: `spec/features/events/holidays.feature`; API: `spec/API.md`; decision: ADR 0039.

## Research (sources)
- Google Calendar API `calendarList.insert` (developers.google.com/workspace/calendar/api/v3/reference/calendarList/insert): body `id`
  required; optional `selected` (default false), `colorId`, `hidden`...; scope `calendar` or `calendar.calendarlist`; returns a
  CalendarList resource. The page does not document error codes (duplicate = 409 per general API behaviour, mock follows that).
- Id scheme and region list: community dumps of Google's "interesting calendars" (gist dhoeric/76bd1c15168ee0ee61ad3bf1730dcb65: 237 ids
  incl. `.official`; gist ynkdir/1438145: older plain ids, `en.` and `ja.`). Google has no list API and no state-level holiday calendars.
- Verified by probe (public iCal feed `calendar.google.com/calendar/ical/<id>/public/basic.ics`, the id counts when it holds events; a
  bogus id answers a 500 page): all 65 curated countries exist in `en` and `de`, with and without `.official` (260 of 260).
  `de.german.official#...` is "Feiertage in Deutschland" (public holidays), `de.german#...` adds "Gedenktage".
- State probes (`de.bavaria#holiday...`) failed, so no German Länder are offered.

## Requirements and acceptance
1. Picker lists only regions whose id verifies (server, `calendars.get`, 404 falls back to `events.list` maxResults 1; cached 24 h). AC: scenarios "A region Google does not know is not offered", `server/test/holidays.test.ts`.
2. Add a region (both variants asked, one variant added at once). AC: "Adding a region...", "A region with one variant...".
3. Language of the id follows the app language, fallback en. AC: unit test.
4. Subscribed calendars are listed under Holidays, switch/colour like any calendar. AC: "switches off and recolours".
5. Remove = calendarList.delete, events leave the device at once. AC: "Removing a region...".
6. Per person. AC: "Another user keeps their own...". 7. Offline: list readable, add/remove says it needs a connection. AC: web unit test.

## Assumptions (no owner answer, night run)
- Region = country (65 curated, EU + Europe + major others); no sub-national calendars exist.
- `calendars.get` on a public calendar not in the list may 404 or 403 for the person's token: the check then tries `events.list`; both failing = not offered. Not verifiable without a real Google account tonight.
- Colour Google gives a new subscription is unknown; the mock uses `#7986cb`. `selected: true` is sent so Google's own UI shows it too.
- Both variants of a country may be subscribed at once. First open of the picker per day makes ~130 checks (6 at once).
- de-x-mainfr / de-x-coldmirror fall back to German for the new texts (partial by design).

## Implementation plan (one PR-sized unit)
spec → API/ADR/model → server provider+service+routes+test routes (unit tests) → web store/sheet/pages (unit tests) → e2e steps and run → verify.
