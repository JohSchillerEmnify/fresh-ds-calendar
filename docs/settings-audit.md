# Settings audit (2026-11-01)

> A snapshot from before the Settings screen was regrouped. Since then the groups and the search were built
> (`settings-groups`, `settings-search`) and `/api/settings` became per person (ADR 0035), so problem 1 below is fixed;
> the counts and the "wrong place" findings describe the old page.

What the Settings screen holds today, where each setting lives, and what is wrong with it. The proposed new structure
is in [`settings-tree.md`](settings-tree.md); the behaviour is specified in `spec/features/app/settings-groups.feature`
and `spec/features/app/settings-search.feature` (all `@backlog`).

Sources: `web/src/views/SettingsView.vue` (one long page, 9 cards), the sub-pages `/settings/theme`,
`/settings/reminders`, `/settings/templates`, the per-person prefs table `shared/prefs.js` (`/api/prefs`) and the
server settings `server/src/services/settingsStore.ts` (`/api/settings`). Screenshots of the live page at 390 px: the
page is 5 836 px tall, about 7 phone screens.

## Counts

| | Count |
|---|---|
| Sections on the page | 9 (Appearance, Calendar, Task lists, Focus & motivation, Motion & sound, Bedtime, Notifications, Labs, Account & data) |
| Sub-pages | 3 (Theme, Reminders, Templates) |
| Settings a person can change on the main page | 61 (incl. 14 Labs, 10 bedtime, 5 notification, 16 in the Calendar card) |
| Information rows / actions (no value) | 12 (streaks, version, certificate, what's new, backup, sign out, ...) |
| Storage places | 4: `/api/prefs` (per person), `/api/settings` (one file for the whole server), `/api/prefs/theme`, device `localStorage` |
| Duplicates (one value, two controls) | 2 |
| Overlaps (two values, one meaning) | 3 |
| Settings in the wrong place | 9 |
| Controls that do not follow M3 Expressive (ADR 0032) | 8 kinds |

## Every setting today

Store: **P** = `/api/prefs` (per person), **S** = `/api/settings` (server file, see problem 1), **T** = theme pref,
**D** = this device only. Labs = only visible while the Labs switch is on.

### Appearance
| Setting | Control | What it does | Default | Store | Labs |
|---|---|---|---|---|---|
| Theme › | link row, shows theme name | opens `/settings/theme` (mode, preset, seed colour, scene, seasonal, glow, entries, corners, density, checkbox, check mark, icon set, own themes import/export) | Default / seasonal | T (mode in S) | no |
| Language | filled select | app language, Automatic = device | Automatic | P `language` | no |

### Calendar
| Setting | Control | What it does | Default | Store | Labs |
|---|---|---|---|---|---|
| Default view | filled select | view the app opens in | Month | S `defaultView` | no |
| Minimum event length | segmented Off/15/30 | short events drawn at least this long | Off | P `minEventMinutes` | no |
| Day view: events side by side | segmented Only 1/2/3/4 | overlap columns in the day view | 4 | P `daySideBySide` | no |
| Week view: events side by side | segmented Only 1/2/3 | overlap columns in the week view | 2 | P `weekSideBySide` | no |
| Top bar size | segmented Expressive/Compact | phone top bar height | auto (Compact on phones) | P `headerLayout` | no |
| Bottom bar size | segmented Expressive/Compact | phone bottom bar height | auto | P `bottomBarSize` | no |
| Month view scrolls | filled select | sideways / up-down / up-down snapping | Sideways | P `monthScroll` | no |
| Approaching card | switch | now/next card above the calendar | on | P `approachingCard` | no |
| Time left | switch | time left in the card vs on the entry | on | P `approachTimeLeft` | no |
| Approaching track | switch | track of what comes next in the card | on | P `approachBar` | no |
| Track reaches ahead | select 3/6/12/Custom + number field | track length in hours | 3 | P `approachWindowHours` | no |
| Sync indicator | switch | sync icon always vs only on failure | off | P `syncIndicator` | no |
| Task lists calendar · Color | swatches, picker, hex | the colour of the task-lists calendar (Google's list colour) | Google's | G calendar list `backgroundColor` | no |
| Left-handed mode | switch | mirrors the phone layout | off | P `leftHanded` | no |
| View switcher · On phones | filled select | bottom/top/rail/side menu | Bottom | P `navPhone` | no |
| View switcher · On desktop | filled select | bottom/top/rail | Rail | P `navDesktop` | no |

### Task lists
| Setting | Control | What it does | Default | Store | Labs |
|---|---|---|---|---|---|
| Task list categories | switch | use categories at all | on | P `taskCategories` | no |
| Categories (list) | rows + up/down icon buttons, dialog | name, colour, icon, order, sharing | Shopping, To-do, Work, Home | S `categories` | no |
| Add category | tonal button (at the end of the section) | new category | – | S | no |
| Show where carried-over lists come from | switch | "From Sat 10 Oct" label | on | P `showCarriedFrom` | no |
| Finished list without a date | segmented | on the day finished / archive only | calendar | P `undatedDone` | no |
| Templates › | link row | `/settings/templates` | – | server | no |
| Tapping a task list | segmented | grows in place / opens the list | inline | P `taskOpen` | no |
| Several lists grown at once | switch (only while grow in place) | more than one grown card stays open | on | P `growSeveral` | no |

### Focus & motivation
| Setting | Control | What it does | Default | Store | Labs |
|---|---|---|---|---|---|
| Calm mode | switch | fewer details, quieter colours, **reduced motion** | off | S `calmMode` | no |
| Streak | segmented Off/Flame/Plant | streak mark in the top bar | Off | P `streak` | no |
| Sunflowers | segmented, disabled unless the scene is Sunflowers | grow with points / full field | grow | S `sunflowers` | no |
| Current streak / Best streak | info rows | numbers | – | server | no |
| Support cat | segmented Off/Sometimes/Every time | cat that cheers | Sometimes | P `supportCat` | no |

### Motion & sound
| Setting | Control | What it does | Default | Store | Labs |
|---|---|---|---|---|---|
| Animations | segmented Full/Reduced/Off | animation level | Full | S `animationLevel` | no |
| Ignore the device setting | switch | override the OS reduced-motion | off | S `ignoreSystemMotion` | no |
| Sounds | switch | sounds | off | S `sounds` | no |

### Bedtime (10 settings, 9 hidden until "on")
`bedtime.enabled` (off), `mode` fixed/dynamic, `bedtime` 23:00, `wake` 07:00, `weekendDifferent` off,
`weekendBedtime` 00:00, `weekendWake` 09:00, `sleepMinutes` 8 h (dynamic only), `leadMinutes` 60 (dynamic only),
`reminderMinutes` 30 (0 = off). All P `bedtime`. Times are plain text fields of type `time`.

### Notifications
| Setting | Control | What it does | Default | Store |
|---|---|---|---|---|
| Reminders › | link row | `/settings/reminders` | – | – |
| Bedtime reminder | switch | push for bedtime | on | P `notify.bedtime` |
| Before appointments | switch | push at each event reminder | on | P `notify.events` |
| Before task lists with a time | switch | push for timed lists | off | P `notify.tasklists` |
| Morning overview + time | switch + time field | daily summary | off, 08:00 | P `notify.morning`, `morningTime` |

### Reminders page (`/settings/reminders`)
Per calendar: Google's default reminders (one card per calendar). Browser push on/off (D, push subscription).
Task lists: **"Remind about task lists"** switch (= `notify.tasklists` again) and default task-list reminders.

### Views (main view switches)
One switch per main view (`stableViews`: Year, Month, Week, Day, Tasks, Clock), all on; the last one on cannot be turned off.

### Labs
Master switch "Experimental views" (`labs`, off); per view switches (`labsViews`: Plain clock, Timeline, Strip,
Zoom, Horizontal, Runway, Now & next); "Generate themes with AI" (`labsOwnThemes`); "Handwritten lists"
(`labsHandwriting`) + "Draw with a finger" (`labsDrawWithFinger`); "Two-row week overview" (`weekTwoRow`) + "Days on the
top row" (`weekTwoRowTop` 4).

### Account & data
Signed in + Sign out; Sign out everywhere; Grant calendar access (only when missing); Drive backup status, Back up now,
Restore; Reset demo data (mock only); Install this app (iOS) / Android app download; Version; App signing certificate;
What's new; **Show version in the corner** (P `versionInCorner`, off).

### Not on the Settings screen
- **Showing / hiding a calendar**: filter chips and side menu (`SideMenu.vue`, `FilterBar.vue`); the coming calendar
  plan (branch `feat/calendar-plan`) is a long press on the chip. No calendar has a settings page.
- Tasks view choices `tasksGroupBy`, `tasksSortBy`, `tasksSortDir`, `tasksFilter`: set in the Tasks view, which is
  right; they stay there.
- Device-only view state (hour height zoom, collapsed tray, collapsed lists, task-section mode): view state, not
  settings; they stay out.

## Top problems

1. **Shared server settings.** `/api/settings` is one file for the whole server (`new SettingsStore(config.dataDir)`),
   so Default view, Calm mode, Animations, Sounds, Ignore device motion, Sunflowers, theme mode and the categories
   are the same for every person who signs in, while everything else is per person. Nothing on screen tells them apart.
2. **Duplicate: task-list reminders** — `notify.tasklists` is switched in Notifications ("Before task lists with a
   time") *and* on the Reminders page ("Remind about task lists").
3. **Duplicate home for reminders** — a Notifications card plus a Reminders sub-page with half of the same topic;
   the card's hint sends people to "Settings → Reminders".
4. **Overlap: bedtime reminder** — `notify.bedtime` (switch in Notifications) and `bedtime.reminderMinutes` (0 = off,
   in Bedtime) both switch the same reminder off.
5. **Overlap: calm mode vs animations** — Calm mode's hint promises reduced motion, the Animations row is a separate
   control in another card; it is unclear which wins.
6. **Calendar card is a dumping ground** — 16 rows: view layout, bar sizes, navigation, left-handed, sync icon, Google
   tasks calendar and four Approaching-card rows. The card is 4 screens long.
7. **Dependent rows always shown** — Time left, Approaching track and Track reaches ahead do nothing while the
   Approaching card is off; they are still shown and active.
8. **Wrong places**: Sunflowers (only applies to one theme scene) sits in Focus; "Show the task lists calendar in Google"
   (a task-lists thing) sits in Calendar; "Show version in the corner" (layout) sits in Account; left-handed mode,
   view switcher and bar sizes (layout) sit in Calendar; "Add category" sits below unrelated rows instead of under the
   category list; the Labs master switch is called "Experimental views" but also gates AI themes, handwriting and the
   two-row week; Bedtime is its own top-level card for one feature; per-calendar default reminders live on the
   Reminders page and calendar visibility lives outside Settings.
9. **Bar sizes cannot go back to Automatic** — `headerLayout`/`bottomBarSize` store `auto`, but the control only offers
   Expressive/Compact, so the first tap loses Automatic for good.
10. **No way to find anything** — 61 settings on a 7-screen page, a table of contents only on desktop, no search.

## Not M3 Expressive today (ADR 0032)

1. **Filled text-field selects** (Language, Default view, Month view scrolls, View switcher, Track reaches ahead,
   bedtime selects) look like form inputs; M3 settings use a list item with the value as supporting text that opens a
   menu or a sheet.
2. **Two-line "column" rows** (label, hint, then a full-width segmented button below) — not an M3 list item; 13 rows.
3. **Outlined buttons inside rows** (Sign out, Sign out everywhere, What's new "Show", Reset, Back up now, Restore):
   the one action vocabulary is tonal or text inside a list, outlined is not part of it.
4. **Category order with up/down icon buttons** instead of a drag handle (M3 list reorder).
5. **Plain time text fields** for bedtime, wake and morning time instead of the M3 time picker in a sheet.
6. **Custom hours as a select plus a free number field** instead of a slider or a single menu.
7. **One long page of cards with a desktop-only table of contents** — no M3 list-detail (settings home → group page)
   and no search bar.
8. **Information rows styled like settings** (current/best streak, version, certificate) mixed between controls.
