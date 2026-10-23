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
- In-app snackbars count down live while the app is open (owner decision, phase 2): "Dentist starts in 28 min" a minute
  after "… 29 min", gone at the start; "Bedtime in 20 minutes", gone at bedtime. Screen readers hear each once.
- Bedtime reminders and morning overviews also come by Web Push (owner decision, phase 2), with the same texts and icons.

## Requirements

1. R1 Each notification kind shows its own icon (Android status bar icon; Web Push badge + icon).
2. R2 Event and task-list notifications (native and Web Push) name the item and its start–end times, never "in X min".
3. R3 Native event, task-list and bedtime notifications count down live to the start.
4. R4 The native bedtime notification says "Bedtime at HH:MM" instead of "Bedtime in X minutes".
5. R5 Every new text goes through the locale files of all languages.
6. R6 Compatibility: a stored native reminder from an older web bundle (no `kind`/`start`) still shows, with the icon
   derived from its id (`bedtime` → moon, `morning` → sunrise, else calendar page) and no countdown; a Web Push without
   `kind` shows the calendar-page icon.
7. R7 While the app is open, the in-app reminder of an event or task list and the bedtime reminder say the minutes really
   left and update on every clock tick; they go away at the start (bedtime); screen readers hear them once.
8. R8 With "Reminders in this browser" on, the bedtime reminders and the morning overviews of the next 7 days are pushed
   as chosen in Settings → Notifications, with the native texts and their own icons.

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
- R7: unit (`live.test.ts`): "Dentist starts in 30 min" at the lead, "… 28 min" two minutes later, the nearest lead
  joining late says the minutes left; unit (`bedtime-reminder.test.ts`): "Bedtime in 20 minutes" at 22:40, "… 1 minute"
  at 22:59, gone at 23:00, snackbar stays (duration 0); the snackbar is `countdown` (`aria-live="off"`, `snackbar-announce.test.ts`). e2e:
  reminders.feature "… counts down while it is open", bedtime.feature "The bedtime reminder counts down while the app is open".
- R8: unit (`push-plan-sync.test.ts`): 7 bedtime entries ("Bedtime at 23:00", '', `bedtime:<night>`) and 7 morning
  entries ("Your day", the overview, `morning:<date>`), none when switched off. e2e: reminders.feature "The bedtime
  reminder and the morning overview also come as browser pushes" (planned, then sent once with the moon / sunrise icon).

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

- A1 (superseded by the owner's phase-2 decision, R7) In the first version the snackbars kept their fixed lead text.
- A2 (superseded by the owner's phase-2 decision, R8) In the first version bedtime and the morning overview were not
  pushed; the web icons and the service worker mapping for all four kinds were already in place.
- A3 The day prefix uses the app's `weekdayDayMonth` date format ("Tue 13 Oct"); a date never goes stale, unlike
  "tomorrow".
- A4 (owner decision after review, replaces the first version) The native notification counts down to the start; at
  the start an alarm re-posts it silently with only its text (no chronometer, `setOnlyAlertOnce`); it disappears at the
  item's end (`setTimeoutAfter`). A notification dismissed before the start stays gone. Bedtime: counts down to bedtime,
  then shows "Bedtime at 23:00" until wake-up, when it disappears (my choice: the night's wake-up time is the natural end).
  The morning overview has no start or end and stays until dismissed. (context7 had no entries for `setTimeoutAfter` /
  `setOnlyAlertOnce`; their presence in androidx.core was proven by compiling, their effect by Robolectric.)
- A5 Colours of the web colour icons: event blue `#1a73e8` (app colour), task list green `#188038`, summary amber
  `#e37400`, bedtime indigo `#3949ab`.

## Implementation notes

- Bug found on the way (root cause proven): the Web Push plan was never sent on a day without appointments today. The
  guard "today's items are loaded" read `items.byDate.has(today)`, which is false for a loaded day with no segments
  (in-app log showed the watcher returning before planning; a Trip on 13 Oct was planned once today got an item). Now
  it checks that a loaded range covers today (`push-plan-sync.test.ts` reproduces it). The native clean-up used the same
  guard and was fixed with it.
- The bedtime native scenario lives in `android-app.feature` (native); `bedtime.feature` gained only the in-app countdown
  scenario (R7).
- PNGs were rendered from the SVG sources with Playwright's Chromium (one-off script, not committed).
- Review round 1 (coordinator): an item ending at a later midnight names the day after its last segment
  ("22:00 – Wed 14 Oct, 00:00"); push plan and native clean-up wait until loaded ranges cover all 8 planned days and fetch
  them otherwise (a today-only load no longer shrinks the server's 7-day plan); reminder, bedtime and morning instants are
  computed from wall-clock times in the calendar zone (were off by an hour across 2026-10-25); the eight notification
  PNGs are precached by the service worker.
- W5: the countdown, the plain text after the start and the removal at the end need the new APK (CHANGELOG 2026-10-23
  says so); an older APK ignores `kind`, `start` and `end` and keeps showing the moon.
- Review round 2: events take their instants from their own offsets (`Date.parse(start/end)`), so one in the repeated
  hour of 2026-10-25 rings on time; task lists (wall-clock only) are rebuilt in the zone. The native schedule is left
  untouched while the planned days are not all loaded (evicted from the 6-range cache), and the window is fetched again;
  I chose not to pin the window against eviction, because a pinned range would never be refetched and its reminders
  would go stale. Only the start re-post is silent (`setOnlyAlertOnce`), so the next morning overview alerts again.
  Cancelling a reminder also cancels its start alarm and its notification. A start alarm after the end removes the
  notification.
- Review round 3: a reminder that rang leaves the plan but is not cancelled while its item is still there with the same
  start, so opening the app keeps its notification (it disappears at the item's end, A4); deleting or moving the item
  cancels it. The bedtime reminder is cancelled only when it is switched off. Not done: cancelling the start alarm in
  `Reminders.schedule` — ids of item reminders are unique per occurrence and lead and are never re-scheduled once they
  rang, and the only reused id is `bedtime`, whose schedule for the next night would then cancel tonight's start
  re-post (tonight's notification would count up past bedtime instead of showing "Bedtime at 23:00").
- Review round 4: a rung reminder is also cancelled when its calendar is hidden or its kind switched off in Settings →
  Notifications (the person no longer wants it; recorded decision, coordinator agreed); it is forgotten without a cancel
  at its end. The bedtime reminder is cancelled when switched off or when a still pending (not rung) reminder has no night
  left in the settings; one that rang stays until wake-up. Countdown snackbars were read out once (replaced in the follow-ups by `aria-live="off"`).
- Phase 2 (owner decisions): live snackbar countdown (R7), bedtime and morning overview by Web Push (R8), and the Android
  app's server chooser removed: the server is configuration (`ServerConfig.BASE_URL` = `https://cal.example.org`,
  ADR 0022). Gone: the chooser page (the bundled `index.html` is now an empty start page Capacitor requires), the Settings
  "Server" row and its texts, the plugin's `get`/`choose`, the "Choose another calendar" link of the offline page (which
  keeps "Try again"), the cleartext exception for `cal.mordor.lan`, and the widget's server-change clean-up. The plugin
  keeps the name `ServerChoice` for the deployed web app's `appVersion` call. No migration: a phone that chose the
  home-network server signs in once on the public one; its widget follows with the next fetch.
- Also in this branch (coordinator): the widget's own week fetch uses the calendar colour for task lists while task
  categories are off (`taskCategories` read with the prefs; default on when unreadable).
- Follow-ups (branch fix/notification-followups): the push plan leaves out a night whose wake-up day is beyond the loaded
  days (dynamic bedtime could not know its first appointment); the plan watcher names `clock.today` (it already moved on
  with the day through `byDate`, which the test shows); a countdown snackbar keeps its text readable and only switches
  off the re-announcement of its changes (`aria-live="off"` on it; its appearance in the polite host is announced), the
  `announce` text is gone; the widget's first fetch after the update forgets a legacy server choice once, with the
  widget's data. More tests: bedtime off / lead 0, hidden calendars in the overview, the 2026-10-25 clock change.
