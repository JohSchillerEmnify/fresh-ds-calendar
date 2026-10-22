# Notification icons per kind, and times instead of "in X min"

Owner request 2026-10-23 (relayed by the night-run coordinator; the owner was asleep, so the assumptions below are mine).

## As Is

- Android native notifications (`ReminderReceiver`) always use `ic_stat_reminder` — the bedtime moon — for every kind:
  event reminders, task-list reminders, the morning overview and the bedtime reminder.
- Web Push (`sw.ts`) shows `{title, body, key}` with no `icon` and no `badge` (the browser's default).
- Event / task-list reminders say "Dentist starts in 30 min" (title) and "11:00" (body), natively and by Web Push. When
  the person looks later, the "in 30 min" is wrong.
- The bedtime notification (native only) says "Bedtime in 30 minutes" / "Bedtime 23:00". Bedtime and the morning overview
  are not sent by Web Push at all.

## To Be

- Four notification kinds, each with its own glyph (24 dp grid, Material-Symbols-like):
  `event` = calendar page (with a marked day), `tasklist` = checklist, `summary` (morning overview) = sunrise,
  `bedtime` = moon. Android: white-on-transparent vector drawables `ic_stat_<kind>`. Web: `badge-<kind>-96.png`
  (monochrome, status bar) and `notification-<kind>-192.png` (colour) in `web/public/icons/`, from the SVG sources
  `notification-<kind>.svg` there.
- Event / task-list notifications: title = the item's title ("Dentist"); text = its times "11:00 – 11:30"
  (Google-Calendar style). When the item is on another day than the reminder rings, the day comes first:
  "Tue 13 Oct, 11:00 – 11:30". An item ending on a later day names the end day ("22:00 – Wed 14 Oct, 01:00").
- Android additionally shows a live countdown to the start in the notification header
  (`setWhen(start)`, `setShowWhen(true)`, `setUsesChronometer(true)`, `setChronometerCountDown(true)`; minSdk is 26, the
  API needs 24).
- Bedtime (owner decision during the run): Android title "Bedtime at 23:00" with the same live countdown to bedtime;
  the moon stays.
- In-app snackbars are unchanged ("Dentist starts in 30 min", "Bedtime in 30 minutes").

## Requirements

1. R1 Each notification kind shows its own icon (Android status bar icon; Web Push badge + icon).
2. R2 Event and task-list notifications (native and Web Push) name the item and its start–end times, never "in X min".
3. R3 Native event, task-list and bedtime notifications count down live to the start.
4. R4 The native bedtime notification says "Bedtime at HH:MM" instead of "Bedtime in X minutes".
5. R5 Every new text goes through the locale files of all languages.
6. R6 Compatibility: a stored native reminder from an older web bundle (no `kind`/`start`) still shows, with the icon
   derived from its id (`bedtime` → moon, `morning` → sunrise, else calendar page) and no countdown; a Web Push without
   `kind` shows the calendar-page icon.

## Acceptance Criteria

- R1: Robolectric: the built notification's small icon is `ic_stat_event` / `ic_stat_tasklist` / `ic_stat_summary` /
  `ic_stat_bedtime` for the four kinds. Unit: the service worker's notification options carry `badge-<kind>-96.png`
  and `notification-<kind>-192.png`. e2e: the recorded pushes of an event and a task list carry the kinds `event` and
  `tasklist`.
- R2: unit (reminder plan): body "11:00 – 11:30", day prefix for a day lead, end day for an overnight item. e2e: the
  push "Dentist" saying "10:40 – 11:30" was sent once.
- R3: Robolectric: `when` = start, `EXTRA_SHOW_CHRONOMETER` and `EXTRA_CHRONOMETER_COUNT_DOWN` true when a start is known.
- R4: unit (bedtime reminder): scheduled title "Bedtime at 22:30", `start` = bedtime, kind `bedtime`.
- R5: `pnpm i18n:check` passes.
- R6: Robolectric: an entry without kind/start uses the id-derived icon and no chronometer.

## Testing Plan

- web vitest: `reminder-plan.test.ts`, `live.test.ts`, `bedtime-reminder.test.ts`, a new `notification-look.test.ts`.
- server vitest: `push.test.ts` (kind travels into the payload; validation accepts the kinds).
- Android Robolectric `ReminderNotificationTest` in the `calendar-android-build` image.
- e2e: only the touched `@web-push` scenarios of `reminders.feature`.

## Implementation Plan

1. Spec + STEPS.md (+ `check-steps.py` = 0).
2. Web: reminder plan times text + kind; push plan kind; native schedule kind/start; bedtime text/kind/start (tests first).
3. Server: plan entry `kind` (optional picklist), payload + recorder carry it (tests first).
4. SW: `notificationLook(kind)` pure helper + icons (tests first).
5. Android: drawables, Entry kind/start, `ReminderReceiver.build` (Robolectric first).
6. e2e steps; targeted e2e run; `pnpm verify`.
One PR: the pieces share the payload contract and ship together.

## Assumptions (owner asleep)

- A1 Snackbars stay as they are: the owner spoke about notifications; the bedtime snackbar lasts 10 s and the event
  snackbar disappears at the start. Flagged in the report.
- A2 Bedtime and the morning overview are not sent by Web Push today; adding them would be a new feature, so the
  "Bedtime at 23:00" web-push text of the owner's decision has nothing to apply to. The web icons for all four kinds exist
  and the service worker maps all four, so such pushes would get the right look. Flagged.
- A3 The day prefix uses the app's `weekdayDayMonth` date format ("Tue 13 Oct"); a date never goes stale, unlike
  "tomorrow".
- A4 The native countdown keeps running past the start (Android then counts up from the start); the notification is not
  auto-removed.
- A5 Colours of the web colour icons: event blue `#1a73e8` (app colour), task list green `#188038`, summary amber
  `#e37400`, bedtime indigo `#3949ab`.

## Implementation notes

- Bug found on the way (root cause proven): the Web Push plan was never sent on a day without appointments today. The
  guard "today's items are loaded" read `items.byDate.has(today)`, which is false for a loaded day with no segments
  (in-app log showed the watcher returning before planning; a Trip on 13 Oct was planned once today got an item). Now
  it checks that a loaded range covers today (`push-plan-sync.test.ts` reproduces it). The native clean-up used the same
  guard and was fixed with it.
- The bedtime native scenario lives in `android-app.feature` (native), so `bedtime.feature` is unchanged; its in-app
  snackbar "Bedtime in 30 minutes" is kept (A1).
- PNGs were rendered from the SVG sources with Playwright's Chromium (one-off script, not committed).
