# All-day events ring by their reminders

## As Is
`web/src/features/calendar/reminderPlan.ts` skips every all-day event (`itemStart` returns null for `allDay`, the plan
`continue`s on `s.allDay`) and every task list without a time (`startTime === null`). So all-day events never ring: not as
in-app snackbar, not as Android native reminder, not as Web Push (all three read the same plan). Bug confirmed by the owner.

## To Be
Like Google (one reminder list; minutes before the start; an all-day event starts at 00:00 of its day in the calendar
zone): every all-day event rings at 00:00 of its first day (calendar zone, DST safe via `localToIso`) minus each lead.
"5 min" rings 23:55 the evening before, 45 min 23:15, 90 min 22:30. A multi-day all-day event rings only for its first day.
A dated task list without a time (the task-list counterpart of all-day) follows the same rule, still only with the
task-list switch (`notify.tasklists`). Carried-over lists never ring (unchanged).
Notification text (no stale countdown): "<day>, all day", e.g. "Tue 13 Oct, all day" (new i18n key
`calendar.reminders.notification.allDay` in en, de, de-x-coldmirror; de-x-mainfr is partial and falls back to de).
Native (Android): `start` = 00:00 of the first day, `end` = 00:00 after the first day. The existing APK counts down to
`start`, then shows the text only, and removes it at `end` -> "count down to 00:00, then 'all day' until the end of the day,
then disappear" works without an APK change.

## Requirements
1. All-day events have one planned reminder per distinct lead at (00:00 of the first day, calendar zone) - lead.
2. Multi-day all-day events plan reminders only for their first day; an all-day event whose first day is today (00:00 passed) plans none.
3. Dated untimed task lists plan reminders the same way, gated by the task-list switch; carried-over lists none.
4. Body of such a reminder: "<weekday day month>, all day" (localized).
5. `endAt` = 00:00 after the first day; `startAt` = 00:00 of the first day; `itemStart` returns that start (so a rung native reminder is kept while the item is unchanged).
6. All channels (snackbar, native, push plan) get them without channel-specific changes.

## Acceptance Criteria
1. Unit: all-day tomorrow with leads 5/45/90 -> `at` 23:55/23:15/22:30 today (Berlin); `startAt` = tomorrow 00:00.
2. Unit: multi-day all-day 13-15 Oct -> reminders only for 13 Oct; all-day today -> none.
3. Unit: untimed dated list -> rings with switch, not without; carried-over list -> none.
4. Unit: body "Tue 13 Oct, all day".
5. Unit: across 2026-10-25 (Sun 00:00 is +02:00) and 2027-03-28 the instants are right; `endAt` correct.
6. e2e: scenarios "An all-day event rings the evening before by its reminder" (snackbar) and
   "A multi-day all-day event rings once, saying its day" (push plan) pass.

## Testing Plan
Red unit tests in `web/test/calendar/reminder-plan.test.ts` first (replace the "none for all-day" assertion), then code.
Then targeted e2e of the two new scenarios plus the existing @reminders scenarios on mobile; `pnpm --silent verify`.

## Implementation Plan
1. Spec scenarios (existing steps only) -> check-steps 0.
2. Unit tests red -> reminderPlan change + i18n keys -> green.
3. Doc comments (reminderPlan / transitionWarning headers say "timed").
4. e2e targeted. One PR-sized unit.

## Assumptions (owner asleep)
- "until the end of the day" = end of the first day, also for a multi-day all-day event (a week-long holiday should not
  keep a notification for a week).
- Occurrence key of an all-day reminder: `<id>@<date>` (no `T<time>`); push keys are free text (server max 200 chars).
- Google birthday entries are all-day events and now ring too (owner's own example is a birthday).
- The in-app snackbar keeps its wording "<title> starts in 5 min" counting down to 00:00 (the live countdown is
  correct while shown; no-stale rule concerns notifications).
