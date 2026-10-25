# Changelog

## 2026-10-25
- Month view: an appointment that runs past midnight but is shorter than a day (e.g. 22:00 to 02:00) is now shown on its start day only, as in Google Calendar; the week and day views still show its part on each day.
- Bedtime: a bedtime at exactly midnight (e.g. weekend times 00:00) now shows its moon at the end of the evening before, so a day never shows two moons; Friday and Saturday get their midnight moon back.
- Task list templates: save any task list as a template (also a finished one, or while creating a list), then start a new list from it with "From template" in the create form and set its date and time. Templates keep the items (unticked), estimate and category, follow you to every device, are kept on the device so they also work without a connection (changing them still needs one), and are managed in Settings › Task lists › Templates. In the Archive, "Use as template" is now called "Copy". On a phone, Edit and Delete in a list's footer are shown as icons.

## 2026-10-24
- Clock view: the middle now says what is running or comes next on two lines, the title over its start time and a full countdown ("19:40 · in 3 h 17 min", "until 19:30 · 1 h left"), so the time is never cut off; timed task lists count too, and when nothing else is on today it names tomorrow's first entry ("Tomorrow 09:00").
- Busy month view: entries that are completely hidden under a day's fade are no longer built, so busy months open and swipe a bit faster; the month looks exactly the same, and opening the day still shows everything.
- The season and holiday scenes in the top bar now move for about ten seconds after you open the app (a butterfly, or at Halloween the bat or the little ghost, passes once) and then rest as a still picture, so they no longer keep the phone busy; with reduced motion they are still from the start. Mordor and the sunflower field move as before.
- Repeating task lists: renaming the list, adding an item, changing an item's text or removing an item now asks "This task list" or "This and all following task lists", as Google does for repeating appointments. Earlier lists stay as they were; later ones you already ticked in keep their ticks. Ticking stays per list.
- The month view is quicker with a busy month: changing and swiping months no longer re-measures every day and appointment, and a sync without changes no longer redraws the calendar.
- On a bad or no connection the app now opens at once with what it showed last on this device (the days you looked at in the last four weeks, your task lists, settings and language), with a small "Last updated 08:12" note; fresh data replaces it as soon as the server answers. Changes still need a connection. Signing out removes it from the device.

## 2026-10-23
- Repeating task lists: ticking an item in one week no longer ticks it in the other weeks, also right after creating the list; undoing or deleting a list you just created removes all its weeks.
- All-day events now ring too: at midnight of their day minus each reminder set for them, as in Google (e.g. 5 min → 23:55 the evening before); events over several days ring once, saying the day and "all day".
- Calendars you can only read: reminders for the whole calendar are saved in Google; reminders on single events of such calendars are kept by the app straight away (Google does not allow them there), without waiting for Google first.
- Dragging a task list item: the other items now slide aside to open a gap where it will land, instead of the item lying on top of them.
- Calendars you can only read: their default reminders can now be set in Settings → Reminders too. Google keeps them for you where it allows; otherwise the app keeps them, and they ring like any other.
- Reminders no longer say "starts in 30 min", which was wrong by the time you looked: they name the appointment with its times, like Google Calendar ("12:00 – 13:30", with the day first when it is not today's).
- Each kind of notification has its own icon: a calendar page for appointments, a checklist for task lists, a sunrise for the morning overview and the moon only for bedtime.
- Android app: a reminder counts down live to the start, then shows just the times until the appointment ends and disappears; the bedtime reminder says "Bedtime at 23:00", counts down to it and goes away at wake-up. Please install the new app from the download link to get this.
- Reminders in the browser now also reach you on days without appointments today, and reminders around the change to winter time ring at the right moment.
- While the app is open, a reminder counts down the minutes really left ("Dentist starts in 28 min"), and the bedtime reminder stays until bedtime, counting down too.
- With "Reminders in this browser" on, the bedtime reminder and the morning overview now also arrive as browser notifications, as chosen in Settings → Notifications.
- Android widget: while task categories are switched off, task lists show their calendar's colour there too (with the new app).
- Android app: no more "Which calendar?" question and no Server row in the settings: the app always uses cal.example.org (with the new app; if you used the home-network calendar, sign in once more).

## 2026-10-21
- New setting "Minimum event length" (Settings → Calendar): Off, 15 or 30 minutes. Shorter events and task lists are then drawn at least that long everywhere, the phone widget included, so their titles stay readable; their real times don't change.
- Events in the day and week views are now always drawn exactly as long as they last, so back-to-back events of the same length look the same; very short events are drawn thin.

## 2026-10-20
- A short task list no longer has its title cut off when an event starts shortly after it: the title sits at the top of the card, and if there is not enough room the two are shown side by side.
- The task switch in the day and week views now has just two levels, titles only and expanded; the "3 tasks" count level is gone, and the two-row week overview has the switch too.

## 2026-10-16
- Importing your own theme is now always available in the theme menu; only generating a theme with AI stays an experimental Labs feature.
- The app is now called Fresh-D's Kalender, with the slogan “Trag ein, trag aus, macht mir nix aus!” on the sign-in screen.
- The app now updates itself to the newest version automatically (no Reload button, and no more updating one version at a time); it waits until you're not mid-edit.
- The task list panel on desktop can now be collapsed, and tapping a list that's already shown in it highlights that row instead of opening a duplicate panel.
- The first item shown for a titleless list now looks exactly like the other items, including its strike-through when done.
- The first item shown for a titleless list is struck through when it is done, like any other item.
- A titleless task list now shows its first item in every view (week, day and month, not only month chips) whenever the card would otherwise be blank.
- The all-day row in the week and day views now packs per day like the month: a multi-day event only takes space on the days it covers and no longer pushes the other days down.
- A titleless task list now shows its first item on compact month chips, so it is not blank in the overview.
- New setting (Settings → Task lists): tapping a task list can either grow it in place (default) or open the list drawer.
- Task lists with no title stay truly titleless: no title is saved to the event and no task is shown as the title; the tasks appear as an equal list.
- Week and day views: events that are only back-to-back no longer look like they overlap; a short event no longer draws over the one below it.
- The site now sends strict browser security rules (no embedding in other sites, no foreign scripts) and limits request sizes; the server runs locked down.
- Security hardening: reminders only go to real push services and one bad device can't block others; removing someone from the allow-list now ends their access immediately; "Sign out everywhere" added; signing out switches push off; sign-in can no longer be blocked by flooding it; backups contain only your own data.
- Android app: sign-in is now bound to the app and the session is no longer copied into phone backups. Please install the new app from the download link once; older versions can no longer start a new sign-in.
- Only your own events can be edited: invitations from others and everything in other people's calendars are look-only, with a line saying why.

## 2026-10-14
- Birthdays work like in Google Calendar: create one with "Birthday" in the new dialog, and rename, recolour, move or delete birthdays (the birth year stays; birthdays from Google Contacts keep their date).
- Settings no longer slide sideways on small phones (the season choices on the Theme page were too wide).
- Reminders can now also arrive in the browser while the app is closed: switch on "Reminders in this browser" under Settings → Reminders.

- Google rate limits no longer break syncing: calendars are cached per person and the app backs off after a failed sync.
- The "New version available" prompt no longer comes back after you reload.
- In the Horizontal view, dragging sideways moves through time instead of jumping to the next week.
- A tapped task list grows in place only as much as it needs, stays on its card when you zoom, and opens the list directly when nothing is cut off.
- In the Horizontal view, titles of long events stay visible while you scroll sideways, and sideways scrolling is smoother.
- In the zoom month, task lists are no longer hidden behind events, and events show at their real time when there is room.
- The zoom month shows every day at its real times from the same zoom level, much earlier than before, and days in a week share their hours.
- On desktop the add button no longer covers the buttons of a notice at the bottom.
- On the Canvas, the first tap after dropping a note works again, for example on the add button.
- In the month view, multi-day events only take room on the days they cover, so every day uses its space for its own events.
- Settings show what's new, and after an update the app tells you once what changed.
- Several reminders per event, read from and saved to Google (Settings → Reminders sets each calendar's default); the app rings at every one, and the single "warn before" setting is gone.

## Older history

## Iteration 1 — walking skeleton (2026-10-12)

Live at **http://cal.mordor.local** (also linked on Homepage as "Calendar").

What you can see:
- App shell, mobile first (works at 375px): top bar with the current period, **Today**, previous/next.
- Bottom tab bar **Month / Week / Day**; floating **+** button opens a "coming soon" sheet.
- Month view: Monday-first grid of the real month, today highlighted; tap a day to open its day view.
- Week view: Mon–Sun columns with an hourly grid (24h). Day view: hour list.
- Deep links: `/month/2026-10`, `/week/2026-10-12`, `/day/2026-10-12`; `/` opens the current month.
- Light and dark mode (follows the phone setting).
- PWA basics: manifest, placeholder icons (192, 512, maskable, apple-touch-icon), service worker, iOS meta tags.
  Installing needs HTTPS, which is still an owner action.

Not yet: events, task lists, Google sync (no data is shown yet).

Under the hood:
- `server/`: Fastify (Node 22, TypeScript), `GET /api/health`, serves the built web app with SPA fallback.
- `web/`: Vue 3 + Vite + Pinia + Vue Router + date-fns.
- Single Docker image; compose file at `/home/sauron/docker-compose/calendar/docker-compose.yaml`.
- Redeploy: `scripts/deploy.sh` (runs tests, rebuilds, waits for health).

## Iteration 1.1 — stack migration (2026-10-12)

No visible feature change; the app looks and works as before, with Material 3 colors and icons.

- Runtime: Node 24.21.0 LTS (was 22.11). Package manager: pnpm 12.11.2 workspaces (`server`, `web`, `e2e`) with a
  `catalog:`; `package-lock.json` and the `light-my-request` override are gone.
- Server: Fastify replaced by Hono 4.13.13 + `@hono/node-server` 2.1.4. Same behavior: `GET /api/health`, JSON 404
  under `/api`, static `web/dist` with SPA fallback. Route modules in `server/src/routes/`, provider folder
  `server/src/providers/`. Tests use `app.request()`.
- Web: Vite 8.3.4, Vue 3.5.43, vue-router 5.4.0, Pinia 4.0.3, Vitest 5.0.3, jsdom 30.1.2, TypeScript 6.0.3,
  vite-plugin-pwa 2.0.0. M3 color roles (`--md-sys-color-*`) from `@material/material-color-utilities`:
  default seed pre-generated into `web/src/theme/tokens.css` (no flash), custom seed generated at runtime by
  `web/src/theme` (lazy chunk), light + dark, forced mode via `<html data-theme>`. Material Symbols via
  `unplugin-icons`; the FAB is now an M3 primary-container FAB.
- Budgets: `pnpm size` (size-limit): initial JS 50.6 kB gz (limit 75), all JS 52.5 kB, CSS 3.4 kB.
- Docker: `node:24.21.0-alpine3.24`, `pnpm deploy --prod`, npm/corepack/yarn stripped from the runtime image.
  Image 172 MB (was 208 MB), about 64 MB gzipped. Idle memory about 21 MiB (docker stats).
  Compose: `mem_limit: 192m`, `NODE_OPTIONS=--max-old-space-size=96 --heapsnapshot-signal=SIGUSR2 --diagnostic-dir=/data`.
- Redeploy: `pnpm redeploy` or `scripts/deploy.sh` (renamed from `deploy`, because `pnpm deploy` is a pnpm command).

## Iteration 2 — full feature set (2026-10-12 ~06:00)
Live at http://cal.mordor.local (mock Google backend with demo data).
- Server: mock Google Calendar provider (JSON in DATA_DIR), full REST API, task lists stored as Google events,
  settings + categories, streak/plant/sunflowers rules, demo seed, inactive real Google adapter.
- Web: Material 3 shell (month picker from title, year/month/week/day, swipe), settings (theme presets incl. Mordor,
  custom color, light/dark, scenes, animations, calm mode, categories), event dialog, time-proportional timeline with
  live now marker, Now card ("35 min left"), transition warnings, drag and drop with spring physics, task list cards,
  expandable lists with rewarding ticks + list-complete celebration, open tasks tray with gentle carry-over,
  streak flame, plant, sunflower field + butterfly, Mordor scene with the Eye.
- Tests: 154 server + 203 web unit tests green; e2e suite (playwright-bdd) executes all spec features — being
  driven to green next.
