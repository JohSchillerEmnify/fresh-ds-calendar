# Task lists calendar colour (#138) and removal of the "show in Google" switch (#139)

## As Is
- Calendar colours are Google's calendar list colour per person (`calendarList.patch` backgroundColor/foregroundColor), edited in Settings > Calendars > calendar > Color. The tasks calendar is not in the list the app shows, so it had no colour row; its colour was only Google's default.
- Switch "Show the task lists calendar in Google" (pref `tasksCalendarVisible`) set the Google list entry's `hidden` flag.

## To Be
- Task lists calendar page has the same Color row (stored in Google, like the others); task lists follow it where the calendar colour is used (no category / categories off), at once on the device and on other devices (device file `tasksCalendarColor`).
- The switch, its pref, texts (en, de, de-x-*) and search entry are gone; PATCH /api/prefs ignores the old key; GET /api/prefs no longer lists it.

## Requirements / acceptance
See `spec/features/task-lists/tasklists-calendar.feature` (3 new scenarios) and server/web unit tests.

## Assumptions
- A tasks calendar that a person already made visible in Google is left untouched (no Google write behind their back); new ones are created hidden as before.
- API: `GET/PATCH /api/calendar-colors/tasks-calendar`, file `tasksCalendarColor` in `/api/changes`.
