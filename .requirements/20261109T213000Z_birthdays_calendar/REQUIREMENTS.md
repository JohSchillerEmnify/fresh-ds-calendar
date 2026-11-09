# Birthdays as a virtual calendar (issue 59)

As Is: birthdays follow the switch and colour of the calendar holding them (Personal, or the old contacts calendar, which Google may hide).
To Be: one app calendar "Birthdays" (see ADR 0038, spec/features/events/birthdays.feature, spec/API.md `GET/PATCH /api/calendars`).
Requirements and acceptance: the scenarios in birthdays.feature and calendars.feature; unit tests in server/test/birthdays-calendar.test.ts.
Assumptions: default colour #9fc6e7; dedupe key = contact + kind + date, else title + date; the diagnostic runs once per person and day.
