# Assumptions

Made by the spec author while the owner was unavailable (2026-10-12). Each one can be changed later; the affected
spec files are named.

## Product

- **A-01 Default view**: `/` opens the default view from settings (Month by default) for today. No "last used view" memory.
- **A-02 Focus date**: switching views keeps a focus date (kept if inside the new period, else today if inside, else
  the first day of the period). Prev/next therefore lands on the first day of the new period. (ARCHITECTURE §5)
- **A-03 Week URL** with a non-Monday date is normalised to its Monday with a history `replace`.
- **A-04 Invalid URLs** redirect to the current month instead of showing an error page.
- **A-05 Titles**: event and task list titles are required (no "(No title)" like Google), max 200 characters. Task list
  item titles max 200, max 200 items per list.
- **A-06 Error texts**: `Title is required`, `Title must be at most 200 characters`, `End must be after start`,
  `Could not save: Google Calendar is unavailable`, `This event was changed elsewhere. Reload it and try again.`,
  banner `Can't reach Google Calendar. Showing the last known data.`
- **A-07 New event defaults**: focus date; next full hour if today (capped at 23:00) else 09:00; 1 h; primary calendar.
  Editing start keeps duration. Form shows inclusive end dates for all-day events.
- **A-08 Calendars in the mock**: `primary` "Personal" `#039be5` and `work` "Work" `#0b8043`. Events can pick one of
  the 11 Google event colors or "Calendar color" (owner update).
- **A-09 Multi-day rendering** (owner update, replaces the one-chip-per-day assumption): events covering 2+ calendar days
  (all-day with exclusive end, or timed lasting 24 h or more) are solid bars like Google Calendar. Month: one bar per
  week row (Mon to Sun) in lanes above the single-day chips, flat edge and arrow on continued ends. Week and day: bars
  in the all-day row across the covered columns. Timed events under 24 h that cross midnight keep one block per day.
  Tap opens the event; dragging moves the whole event by whole days (shift = drop cell minus grabbed cell).
- **A-64 Overlapping timed blocks** (week / day): overlapping events whose starts differ by 15 min or more cascade (later
  one on top, indented 10 px per level, max 3 levels) so titles stay readable; starts closer than 15 min share equal
  columns; beyond depth 3 blocks fall back to columns. Constants in `lib/items.ts`.
- **A-10 Month overflow** (owner 2026-10-12): no `+N`; a cell shows as many entries as fit and fades the rest out at
  the bottom. Tapping the cell opens the day.
- **A-11 Timed task lists** are 30-minute Google events; untimed ones are all-day events. They live in one calendar
  (the person's hidden "Calendar app: tasks" calendar, ARCHITECTURE §3); the task list form has no calendar picker.
- **A-12 No offline writes**: changes made while Google/network is unavailable fail visibly (dialog error or rollback)
  instead of being queued. Read-only offline (last known data + app shell).
- **A-13 Conflicts**: event and task list detail edits use etags (`If-Match`) and are rejected when stale. Item-level
  operations merge server-side (read-modify-write) and never conflict.
- **A-14 Description mirror**: `extendedProperties` are authoritative. Editing the `☐/☑` lines in the Google app is
  overwritten on the next app change. Task list events with `kind=tasklist` but no `items` property are parsed from
  the description.
- **A-15 Recurring events**: displayed (expanded instances) but not creatable; editing an instance edits only that
  instance. Not covered by e2e because the mock does not need recurrence rules in v1.
- **A-16 Reordering** items uses up/down buttons (deterministic for tests), marked `@optional`; drag and drop is a
  possible later enhancement.
- **A-17 Google Tasks** integration is out of scope (brief: nice to have).
- **A-18 Language/locale**: English UI, `en-GB` date formats, 24 h, Monday week start, Europe/Berlin.

## Mobile and PWA

- **A-19 Mobile first** (owner update): phone layout below 768 px is the primary design; desktop is a secondary layout
  of the same components. Default Playwright project is `mobile` (375×812, touch); `desktop` (1280×800) is second.
- **A-20 Phone month view**: compact chips (title only); tapping anywhere in a cell opens that day's view ("agenda").
  The day view doubles as the agenda (all-day area + time grid); no separate list-style agenda screen in v1.
- **A-21 Swipes** are implemented with touch events on the calendar area (no gesture library), so tests can dispatch
  them deterministically.
- **A-22 Theme color** `#1a73e8`, background `#ffffff`, app name and short name "Calendar". Icons are generated from
  one SVG source (simple calendar glyph) in 180/192/512 and maskable 512.
- **A-23 Secure context** (owner update): service workers and the Android install prompt need HTTPS.
  `http://cal.mordor.local` is not secure, so there: no service worker / offline shell, Android only creates a browser
  shortcut, iOS Add to Home Screen works without offline support. The app must detect this and degrade silently.
  E2E tests the PWA features on `http://localhost` (a secure context).
- **A-24 HTTPS plan** (owner decision): Let's Encrypt DNS-01 via Cloudflare DNS (domain at Namecheap, nameservers at
  Cloudflare free plan), wildcard `*.<subdomain>.<owner-domain>`, LAN only (no public A records, Pi-hole → 192.168.1.38).
  Owner action, not done yet; guide: `/home/sauron/docker-compose/traefik/HTTPS-GUIDE.md`. Until then the deployment is
  HTTP only and AC-45 (installability) is pending. The app never hardcodes a host: `PUBLIC_URL` / `ALLOWED_ORIGINS`.
- **A-25 Future URLs**: app `https://cal.<subdomain>.<owner-domain>`; Google OAuth redirect
  `https://cal.<subdomain>.<owner-domain>/api/auth/google/callback`. Tunnels/VPNs (Tailscale, Cloudflare Tunnel) are not
  used (owner rejected them); a local CA (mkcert/step-ca) is only a fallback.
- **A-26 Away from home** the LAN-only name does not resolve; the installed app shows its cached shell and the error
  banner. This is accepted (not exposed to the internet by design).

## Testing and operations

- **A-27 Test clock**: `POST /api/__test/clock` sets a frozen "now"; the web app reads it from `/api/config` at startup
  and on focus. "Given today is D" means D 08:00 Europe/Berlin. Real time still drives timers (polling).
- **A-28 Polling in tests**: default 30 s; scenarios that rely on polling set it to 2 s via `/api/__test/config`;
  focus scenarios disable polling so focus is proven to trigger the sync.
- **A-29 Outage simulation** is a provider-level switch (server stays up); network loss is simulated with Playwright
  `context.setOffline`.
- **A-30 One worker**: e2e runs serially (`workers: 1`) because all scenarios share one mock backend; each scenario
  starts with `POST /api/__test/reset`.
- **A-31 Data fixtures** are created through the public API, not by writing the JSON file.
- **A-32 Budgets** (owner update): initial JS ≤ 150 kB compressed, month view rendered ≤ 2 s, Lighthouse mobile median of 3 runs ≥ 70 (A-159)
  on localhost, idle server RSS ≤ 80 MB, < 20 MB RSS growth under a 5 000-request soak, < 10 % frontend heap/DOM/listener
  growth after 50× navigation and dialog cycles. Memory is measured in Chromium only (DevTools protocol); Safari is not
  measured.
- **A-33 Demo seed**: a few events and two task lists around the current week, only when the store is empty and
  `SEED` is not `false`.
- **A-34 No authentication** for the app itself: it is LAN-only and single-user. Anyone on the LAN can read/write the
  calendar. Revisit if it is ever exposed.

## Design and efficiency (owner update)

- **A-35 Theme mode** (superseded by owner, 2026-10-12): Settings offer System / Light / Dark; default System.
- **A-36 Dynamic color** (updated): the M3 scheme is generated at runtime from the user's seed color (8 presets or a
  custom hex; default Blue `#1a73e8`). Android wallpaper-based dynamic color is not available to web apps and is out of
  scope.
- **A-37 Component library**: M3 components are built in-house on design tokens to meet the bundle budget, unless
  `docs/RESEARCH.md` decides otherwise. Navigation rail on desktop, navigation bar on phones.
- **A-38 Stack overrides**: the "Decision" section of `docs/RESEARCH.md` overrides stack choices in the BRIEF and in
  ARCHITECTURE.md. The spec contracts (features, steps, API, testids, env vars) stay valid regardless of the stack.
- **A-39 Fonts and icons**: system font stack (Roboto on Android, SF on iOS), inline SVG icons; no web font downloads.

## Settings, categories, colors (owner update: "not an exact Google clone, prettiness matters")

- **A-40 Settings storage**: one JSON file `DATA_DIR/settings.json`, single user, no auth; last write wins with a
  `version` check (`If-Match`). Settings do not sync to Google.
- **A-41 Default categories** ship with fixed ids so tests and URLs are stable: `shopping` Shopping #0b8043 🛒,
  `todo` To-do #3f51b5 ✅, `work` Work #8e24aa 💼, `home` Home #f4511e 🏠 (colors taken from the Google palette so
  they look identical in Google Calendar). Default seed presets: Blue #1a73e8, Purple #6750a4, Teal #006a6a,
  Green #386a20, Orange #e8710a, Red #b3261e, Pink #c2185b, Slate #4f6170.
- **A-42 Icons** are emoji (one grapheme), not an icon set; this keeps the bundle small and looks native on both iOS
  and Android.
- **A-43 Filters** apply only to task lists (events always stay visible), live in the URL query (deep-linkable,
  per tab, not persisted in settings). Categories OR, tags OR, category group AND tag group. The tag filter lists the
  tags of the loaded items only.
- **A-44 Category color in Google**: nearest Google `colorId` by CIE76 ΔE in CIELAB. A category color change updates
  Google `colorId` lazily on the next write of each task list. Deleting a category leaves the stale `categoryId` in
  Google; the API treats unknown ids as "no category".
- **A-45 Tags**: free text, trimmed, max 10 per list, 1–30 chars, no commas, case-insensitively unique; displayed as
  typed. Stored as a JSON array in `extendedProperties.private.tags`.
- **A-46 Uncategorized task lists** use the calendar color (`#039be5` for Personal), like events without a color.
- **A-47 Default event color** setting pre-selects the color in the new event form only; the API default stays
  "calendar color".
- **A-48 Default view** setting only affects `/`; deep links are unaffected.

## ADHD focus (owner update; see docs/ADHD-RESEARCH.md)

- **A-49 Carry-over window**: open task lists from the last 30 days are carried to today. Older ones stay on their
  date, so the tray does not grow forever. The API allows up to 90 days if this needs changing.
- **A-50 Carried lists appear only on today**, not also on their original date, to avoid duplicates. Their Google date
  does not change unless the user picks "Move to today" or drags them.
- **A-51 Now card placement**: day view (today) and week view (current week) only; not in month or year view (less
  clutter). The current event is the one ending first when several overlap.
- **A-52 Transition warnings** are in-app snackbars only (default 10 min). System notifications need HTTPS,
  permission and, on iOS, an installed PWA. They are deferred.
- **A-53 Estimates** are per task list (minutes), not per item. Per-item estimates and estimate-vs-actual learning
  are future work.
- **A-54 Recurring task lists** are `@optional` for the prototype (Google recurrence with per-instance ticks).
- **A-55 Drag and drop** keeps timed items timed and all-day items all-day (no conversion by dragging between the
  all-day area and the grid), preserves duration, snaps to 15 min, and moves multi-day events by whole days (bars: the day cell grabbed to the drop cell).
  Long-press threshold 350 ms (touch, and mouse press-and-hold). Haptics only where `navigator.vibrate` exists (not iOS Safari).
- **A-56 Animation level** default Full. The system "reduce motion" preference always caps it at Reduced, even if Full
  is chosen (accessibility wins). Sounds default off.
- **A-57 Streak** (owner request) counts app opens per local day, not tasks done. A gap resets it quietly to 1 with
  "Welcome back!". There is no loss messaging and no notifications. This is a deliberate owner A/B choice, made despite
  research cautions about streaks (docs/ADHD-RESEARCH.md §1.8).
- **A-58 Plant rules** (fixed for testability): check-in +10, create event/task list +5, tick +2 (once per item per
  day), daily cap 30. Stages at 0/20/60/140/280. Mood by days since last watering: 0–1 happy, 2 thirsty, 3 dry,
  ≥ 4 droopy (floor). It never dies, and growth never decreases. Motivation settings: streak flame on/off (default on)
  and Plant on/off (default on; replaced the garden style, see A-70).
- **A-62 Sunflowers**: one per 40 growth points, max 30 stored (was 24); 15 visible on phones (< 600 px), 30 on wider
  screens (was 12 / 24). They share the plant's mood and never decrease. The Motivation setting "Sunflowers" is
  "Grow with points" (default) or "Full field" (fixed 30, 15 on phones, no growth).
- **A-63 Butterfly**: once per browser-tab session (`sessionStorage`), only at motion level Full and with ≥ 1
  sunflower. Its landing flower is random (not asserted in tests).
- **A-59 Year view density** buckets: 0, 1, 2–3, ≥ 4 items per day.
- **A-60 Month picker** jumps the current view to the picked day. It does not switch views.
- **A-61 Phone navigation** has four destinations (Year, Month, Week, Day; the Tasks view adds a fifth, see ARCHITECTURE "Tasks view"). The open tasks tray sits above the
  navigation bar, and the FAB floats above the tray bar. While the tray is expanded the FAB slides away (owner
  2026-10-12), so it never covers the tray's controls; it returns when the tray is collapsed.
- **A-E1** withdrawn (overflow is a fade now, A-10).
- **A-E2 "I tap the day D in the month view" on desktop** (timeline "phone month view" scenario also runs on desktop):
  without touch the step clicks the day number. Since 2026-10-12 (owner request) empty space in a desktop cell also opens
  the day, but the cell centre may hold an entry, whose click opens the entry instead.
- **A-E3 Phone month chips**: a tap on a chip opens the day (like a tap anywhere in the cell); a long press picks the
  chip up to drag it to another day (dnd "month view" scenario runs on the phone project).
- **A-E4 Time grid minimum block**: events shorter than 24 px are drawn 24 px tall (the 1 px gap included, 25 px box); the
  step "positioned from/to" allows the clamped height for such events.
- **A-E5 Drawn height counts for overlap**: a block drawn taller than its duration (events and task lists alike: 24 px minimum;
  the former 44 px task list minimum was dropped on 2026-10-13, owner) occupies its drawn height when entries are laid out; an entry starting inside it is placed
  as overlapping (side by side or stacked), so nothing hides another entry's title (owner, 2026-10-12).
- **A-T1 Drag back and forth on a phone** (performance.feature): the day view on a phone has a single column, so the
  step switches client-side to the week view (no reload) before moving the event +1/-1 day.
- **A-T2 Fixtures award no plant points**: setup steps that create events/task lists through the API restore the plant
  state afterwards, so scenarios count only points earned by their own actions.
- **A-65 Who may sign in** (owner, 2026-10-12): an allow-list of Google addresses in the server configuration
  (`ALLOWED_EMAILS`); changing it means a restart. At least the owner and one more person. Passkeys come later.
- **A-66 Session length** (owner): 90 days, extended every time the app is used.
- **A-67 Public instance** (owner): the real instance runs on a small netcup VPS under a domain at INWX/Namecheap/
  Porkbun, reachable from the internet; sauron keeps the mock instance and previews. Supersedes A-24/A-25 (LAN-only
  HTTPS via Cloudflare) for the real instance.
- **A-68 Approaching card always compact** (owner, 2026-10-13): the card always has its slim (formerly collapsed)
  form; an expanded form may come back as a later feature.
- **A-69 One scene choice** (owner, 2026-10-13; wording of the migration inferred, flagged for confirmation): the old
  "Top bar scene" setting and the theme's "Scene" attribute become one theme attribute. On migration the scene that was
  visible wins (the theme's if it was not None, else the old top bar setting). "Season" now is a standing "follow the
  season" value (A-71). (The garden-style gate for the Sunflower field is gone, see A-70.)
- **A-71 Season scene sentinel** (owner, 2026-10-13; the storage choice is my assumption, flagged): every scene can be
  picked on its own. "Season" is stored as the value `season` and resolved by date; an explicit pick is stored as the
  concrete scene. A person who earlier picked "Season" has today's concrete season scene stored, so after the change
  that shows as an explicit pick of that scene (no data migration; picking "Season" again makes it automatic).
  Automatic theme with no scene override shows "Season" as chosen.
- **A-70 Scene and plant are separate** (owner, 2026-10-13): "scene" is the top bar background, "plant" the motivation
  widget; the term "garden style" is removed. The Sunflower field shows whenever it is the chosen scene. Reason: one
  setting (garden style) mixed a widget and a background, so choosing the Sunflower field scene could show nothing
  while hiding the plant. Alternative weighed: keeping garden style as a third value in the scene choice (rejected by
  the owner). Assumptions made while implementing (flagged for confirmation): (a) migration maps `plant` to true only
  for old garden `plant`, so old `sunflowers` and `off` hide the plant widget as before; (b) old `sunflowers` turns
  the scene on only for Default and Neon people without an override (they saw the field; season presets keep the
  scene they saw); (c) old `plant` / `off` with an explicit `sunflowers` scene override become scene `none`, because
  they never saw the field; (d) Default and Neon now start with scene `none` so a fresh Default look is unchanged
  (before, the field was hidden by the default garden `plant`); (e) in "Full field" the mood still follows the plant,
  only the count and the bloom are fixed; (f) the "Sunflowers" setting is global like the plant switch (not per
  person), and is shown even when the scene is not the Sunflower field.
  visible wins (the theme's if it was not None, else the old top bar setting). "Sunflower field" still needs garden
  style "Sunflower field" to show. "Season" stores today's season scene, not a standing "follow the season" value.
- **A-93 Left-handed mode** (owner, 2026-10-13; the details below are assumptions, flagged for confirmation):
  a person pref `leftHanded` (like `versionInCorner`), phone layout only. (a) The setting sits in Settings → Calendar,
  label "Left-handed mode". (b) The filter button moves with the settings button (the whole actions group, gear
  leftmost). (c) The version label's text "bottom left" becomes "A small label in a bottom corner" (neutral). (d) The
  settings row that links to the theme menu (chevron) does not mirror; the category rows do (move buttons at the left,
  in reversed order); the "Add category" row and full-width fields stay; every row with a switch or trailing control
  mirrors. The unused `Menu` component is mirrored too, for when it is used again. (e) The support cat stands at the
  start of the finished list's title instead of its end, facing right. (f) The drag helper cat mirrors only its default
  side, the hop away and the ask mark; sideways pushing stays "behind the movement", as that is physics, not
  handedness; it is covered by unit tests, not by a scenario (the drag step needs a mouse). (g) The tray's chevron
  sits to the right of the FAB's clearance at the left, followed by the count chip. (h) The e2e side check compares the
  element centre with the viewport centre.

  person), shown but inactive with a hint when the scene is not the Sunflower field (owner, confirmed).
- **A-94 Open in the Tasks view** (assumption, slice 1 of the task management feature): a list is open when it is not
  complete, so a list with no items yet also shows (the tray, by contrast, lists only lists with an unticked item).
  A finished list leaves the Tasks view on its next refresh; until then it stays, struck through, so the celebration
  can play.
- **A-95 Which dated lists the Tasks view fetches** (assumption): open lists dated from one year before today to one
  year after, plus all undated lists. Lists further out are not shown there (they stay in the calendar).
- **A-72 Sort directions** (assumption): Date earliest first (undated last); Name A to Z (case-insensitive); Category by
  the order of the categories in the settings (no category last); Last changed newest first; Progress most done first
  (done share of the items; a list without items counts as 0 %). Ties fall back to Date, then Name. Inside a group the
  chosen sort applies. Groups: Time in the order Overdue, Today, This week, Later, No date; Category in the settings
  order, then "No category"; None = one group. Empty groups are not shown. "This week" = tomorrow until the coming
  Sunday (weeks start on Monday); on a Sunday it is empty.
- **A-80 Sort direction** (owner decision, 2026-10-13; storage form is my choice, recommended by the coordinator): the pref
  `tasksSortDir` is `default` | `reversed` and is **relative to each sort key's own default direction** (A-72), not
  absolute, because the defaults differ per key (date earliest first, last changed newest first, ...). `reversed`
  flips the chosen key for every key; the tie-break (date, then name) keeps its direction. Group order is not
  affected. Default `default`. The toggle `tasks-sort-dir` sits next to the sort control.
- **A-73 Dating through the dialog** (assumption): the task list dialog gets a "No date" toggle beside the date field
  (also when creating from a calendar view); with it on the date and time are empty and the list is saved undated.
  Clearing the date field by hand without the toggle still fails with "Pick a date". An undated list has no time, no
  estimate-based block and cannot repeat (the server answers 400 for a repeat on an undated list).
- **A-74 Quick actions** (assumption): "Today" and "Tomorrow" set the date to the app-clock day (tomorrow = +1) and
  keep the time; an undated list gets no time. They show on every list in the Tasks view, dated or not.
- **A-75 Completion re-dating** (owner decision, wording inferred): only a write that ticks the last open item of an
  undated list dates it (to the app-clock day, untimed) and sets `completedOn` to the same day. A list already
  complete, or created complete, is not re-dated. The later Archive slice adds a setting to switch this; not built yet.
- **A-76 New list from the "+" in the Tasks view** (assumption): the button is the existing create button; in this view
  it opens the task list dialog directly (no Event/Task list switch) with "No date" on.
- **A-77 Filter chips in the Tasks view** (assumption, owner: reuse if simple): the category chips of the calendar
  (`filter-bar`, `categories` URL query, "No category" included) filter the Tasks view; calendar chips are not offered
  there because they do not apply to task lists. The filter button is in the Tasks view's top bar.
- **A-78 Tasks view top bar** (assumption): no period title and no previous/next/Today buttons (they do not apply); it
  shows the title "Tasks", the sync status, the filter button and the settings button. The calendar swipe is off.
- **A-79 Undated lists in Google** (owner decision): they are all-day events on 2099-12-31 in the tasks calendar. The
  server never lets them into a date range read (it drops anchor-date events of undated lists), so a range that
  reaches 2099 does not show them.

- **A-96 Drawn scene building blocks** (owner decided the format, 2026-10-13; the exact lists are my proposal, flagged
  for confirmation): decor = `stars`, `sparkles`, `waves`, `hills`, `hearts`, `clouds`, `confetti`, `bubbles`; density =
  `low` 8 / `medium` 16 / `high` 28 shapes (waves and hills: 1 / 2 / 3 layers); `density` defaults to medium and
  `decor` to none; a gradient has 2 or 3 colours; in dark mode the gradient is dimmed (darkened by about 40 %); decor
  animates only at the Full animation level. The role overrides allowed in a document are the eight in ARCHITECTURE
  "Theme engine and AI themes".
- **A-97 What the Labs switch hides** (owner 2026-10-13): only "Create with AI" and the import. Saved own themes
  always show in the gallery and a chosen one always applies, so switching off never looks like data loss.
- **A-98 Save as my theme** (owner asked for the button; the details are my choices, flagged for confirmation): the
  button is the last control of Fine-tuning (the look being saved is right above it); the name defaults to "My theme"
  and a taken name gets a number ("My theme 2") instead of being refused, so saving never fails on a duplicate; it
  becomes the chosen theme at once; mode `system` is saved as `follow`, while seed colour and the other settings are
  saved as set, so the theme no longer follows later changes of the person's seed; an own picture is saved as the
  theme's picture, and a scene override on top of an own scene saves the overriding built-in scene instead.
- **A-99 Holiday scenes and "Seasons & holidays"** (owner decisions 2026-10-13 are final; the readings below are mine,
  flagged for confirmation): (a) **New Year** is 1 January only, then the calendar is Winter again; (b) the Easter window
  "two weeks around Easter" is Easter Sunday minus 7 days to plus 6 days (14 days); (c) the Christmas window is the
  1st Advent Sunday (the 4th Sunday before 25 December) to 30 December; the 4th Advent Sunday is the last Sunday on or
  before 24 December; candles on a date before 24 December = 1 + whole weeks since the 1st Advent (max 4); from 24
  December all four are lit and the tree lights are on; (d) the Christmas scene picked by hand outside its dates shows
  the full state (tree lights on, 4 candles), also the "Christmas" sample in the Scene card; (e) the `season` sentinel
  and the seasons & holidays setting use the same calendar mapping; (f) the holiday presets keep the person's light/dark mode like the season
  presets (no forced dark, except New Year's Eve, which is dark like Neon and Mordor — owner 2026-10-13); (g) preset names are
  the labels ("Easter", "Summer holidays", "Christmas", "New Year's Eve", "New Year") and the scene values are `easter`,
  `summerholidays`, `christmas`, `newyearseve`, `newyear`; (h) the pref stores `seasonal` (`off` | `header` | `all`) and nothing else for this (owner journey, final); new
  people get `all` on base Default; "Automatic" and the `season` scene sentinel are gone, because `header` resolves the
  calendar's scene directly; migration on read (marker `seasonalMigrated`): preset Automatic becomes Default + `all`
  (an explicit scene override of an old Automatic stays and wins), a stored scene `season` becomes `header` with the
  override removed, everything else `off`; (i) in `all` the calendar's theme replaces seed, mode rule, glow, entries,
  corners and an imported theme's role colours (the font stays the base's); these are the attributes counted as
  "colours and style"; fine-tuning overrides sit on top, and an explicit scene override wins over the calendar's scene;
  choosing a preset turns `all` into `header` and resets overrides, picking a scene sets `off`, setting `header` or
  `all` drops the scene override; (j) the line under the control reads "Today: <calendar theme> header & colours",
  "Today: <calendar theme> header" or "Today: nothing changes automatically"; the settings row reads "<calendar
  theme>" (all), "<theme> · <calendar theme> header" (header) and "<theme>" (off), the theme being the chosen preset or
  own theme name; (k) Christmas, New Year's Eve and New Year have a cat but no butterflies; the fireworks
  and the candle flicker run only at Full motion (at Reduced and Off the fireworks stand still, the flames are steady);
  (l) holiday presets' colours: Easter #8e6bbf, Summer holidays #0097a7, Christmas #c62828, New Year's Eve #d4af37,
  New Year #00897b.
- **A-100 Fine-tuning sliders, density and icon choices** (owner decisions 2026-10-13 are final; the readings below are mine,
  flagged for confirmation): (a) **between steps no step is pressed**; a pressed step means exactly its value (glow Off 0 /
  Soft 40 / Neon 100, radius Square 2 / Round 6 / Pill 28 px); (b) glow strength runs 0..150, "beyond Neon" being up to a
  blur of 20 px at 150; the neon pulse starts at 100; (c) the corner slider runs 0..28 px, 28 = pill (chips 999 px); timed
  blocks take a derived radius (about a third rounder, 16 px at most), so 4 px gives 5 px on a timed event; (d) the entry
  tint (5..60 %, default 24) applies to Tinted only, Solid and Outline ignore it, the slider is disabled for them; (e) the
  density is three steps (Compact 0.9, Comfortable 1, Airy 1.12 of the font size), not a slider; it scales font sizes and
  the task list row height, not line heights and not the time grid; (f) the checkbox has two settings: shape (round, square,
  rounded; default rounded, which is today's look) and fill (filled default, outline), the glyph a third (tick default, bold
  tick, cross, dot); they apply to the task item checkbox and the preview; the tiny box in the task list card takes the shape only (its mark stays a tick); (g) steps store their
  value too (`glow` + `glowStrength`), so a step pick over a theme that carries its own number wins; (h) an own theme's
  `glowStrength`/`radius` win over its `glow`/`corners` step for the look, but the step fields are always written; (i) the
  **app icon set** was first left out and then built (see A-101); (j) the new document fields are top-level and flat (`glowStrength`, `radius`, `tint`,
  `density`, `checkbox`, `checkFill`, `check`); `density` is not the scene's `scene.density` (decor amount).
- **A-101 App icon set** (owner confirmed A-100 and asked for option (a), 2026-10-13; the readings are mine): (a) the field is
  `icons` (`outlined` default = today's icons, `rounded`, `sharp`), an override like the others, reset by a preset pick,
  saved in "Save as my theme"; (b) the set is a module-level reactive value plus `<html data-icons>`, not a store; (c) the
  24 icons in use are mapped to their Material Symbols variants; a few have identical sharp or rounded drawings in the
  set (aliases), so those icons do not change; (d) all three variants are bundled, none lazy; (e) icons drawn by other
  means (emoji, the scene art, inline SVG such as the checkbox glyphs) are not part of the set.

- **A-81 Library and version** (owner decision 1, 2026-10-13): vue-i18n 11.4.12 (exact pin, released 2026-09-16, the
  newest release at least two weeks old; 11.4.13/14 and 12.0.0-alpha are newer), Composition API (`legacy: false`),
  compiling message strings at runtime in the browser (A-91), with the build flags `__VUE_I18N_LEGACY_API__`,
  `__VUE_I18N_FULL_INSTALL__` and `__INTLIFY_PROD_DEVTOOLS__` off (about 3 kB gzip). The vue-i18n plugin is not
  installed on the Vue app: UI code uses our typed `t()`. Locale files keep a default export (kept after the unplugin
  was dropped: harmless, and the schema types in `i18n/schema.ts` stay independent of the data).
- **A-82 Locale codes** (picked, logged as asked): `en`, `de`, `de-x-mainfr`, `de-x-coldmirror`. The owner named the
  last one, but BCP 47 private-use subtags have at most eight characters, so it is not a valid tag: it stays the
  internal id (pref value, catalogue file) and is never passed to `Intl`; `<html lang>` gets `de-x-coldmir`.
  `Intl` always receives `en-GB` or `de-DE`.
- **A-83 `auto` resolution** (inferred): only the first entry of `navigator.languages` decides (`de`, `de-AT`, … give
  German, anything else English). Weighed: "any German entry anywhere in the list" (rejected: an English-first browser
  with German as a second language is more likely to want English).
- **A-84 First paint** (inferred): the last language pref is cached in `localStorage` (`language`, per device, wrapped
  in try/catch) and applied before the app mounts, so a person who chose English on a German browser does not see German
  flash up while the prefs load. The server value wins as soon as it arrives.
- **A-85 Date formats** (checked against `Intl`): English keeps today's date-fns forms ("28 Sep – 4 Oct 2026"; `Intl`
  en-GB would say "Sept"). German, Fränggisch and Coldmirror use `Intl` de-DE: the day view header reads "Dienstag,
  13. Oktober 2026" (the form "Di., 13. Okt." is what `Intl` gives for a short weekday with day and month; no view header
  uses it), the week "12. – 18. Okt. 2026", weekday headers "Mo".."So". vue-i18n's `d`/`n` formats are not configured:
  nothing uses them yet and `lib/dates.ts` already centralises dates. Month and weekday names in the month, year and
  strip views and the month picker follow the language (a one-line change in each, not a string migration).
- **A-86 Typed keys** (inferred): a thin `t()` wrapper whose key type is the union of the dotted paths of `en.ts`, and
  `de.ts` typed as the full schema. vue-i18n's `DefineLocaleMessage` augmentation was weighed; it does not make a
  misspelt key a compile error in every call form.
- **A-87 Server message keys**: the optional `error.key` equals a catalogue path. Only the user-facing validation
  errors that exist in the web catalogue got keys (end after start, event length, task list title/items/tags, category
  name exists); every other message stays English-only until its area is migrated. The server never translates.
- **A-88 Raw-text check** (owner decision 7: only if lightweight): a unit test over the templates of an explicit list of
  migrated components, no eslint plugin (the repo has no eslint). The list grows per migrated area.
- **A-89 Fun-language wording** is written by the agent and needs the owner's eye. Fränggisch is light ("des", "ned",
  "bassd", "etz", "amal", "gud", "Eisdellunga"); Coldmirror is complete and speaks as "Fresh Dumbledore" (an ancient headmaster
  rapping too hard: "Yo", "Digga", "fresh", sign-out "Yo, vielen lieben thank und schönen day noch!") with sparse
  "Schinken!", "BÄMbus!", "Was ist das für 1 …", "du Oberpflaume", "Eulen. Eulen everywhere." and never "Ich bin voll
  geil". Fränggisch stays partial on purpose.
- **A-90 Settings row**: "Language" sits at the end of Appearance (below Theme). The Automatic option is translated;
  the language names are not (each in its own name). Choosing saves through `PATCH /api/prefs` like the other prefs.
- **A-91 First-load size** (owner decision, 2026-10-13: runtime compiling): messages are compiled in the browser by
  vue-i18n's own compiler. Precompiling with `@intlify/unplugin-vue-i18n` was built and measured: vue-i18n 11.4.12 still
  needs its code generator to turn the precompiled ASTs into functions, so only the parser was dropped and the first
  load got 1.7 kB bigger (133,735 B against 132,005 B); a hook that removed the compiler registration saved 3.4 kB
  but blanked the production build (`SyntaxError: 24` on the first `t()`) and was rejected (no patched vendor code).
  Measured first-load JS (gzip -9 of the chunks `index.html` loads): master 114,791 B; with i18n now 131,993 B
  (+17.2 kB, mostly vue-i18n's composer and compiler). size-limit "initial JS" (`index-*.js` only) is 64 kB of 75; "all
  JS" was already over its limit. Consequence: catalogue strings may use the full message syntax and runtime strings
  can be compiled; `{`, `}`, `@` and `|` in a message must be escaped. Smaller options, if wanted later: function
  messages or a minimal formatter instead of vue-i18n (not chosen: decision 1 fixes vue-i18n).
- **A-92 Test step "the browser language is"**: an init script on the current context overrides `navigator.language`
  and `navigator.languages` (a Playwright context cannot change its `locale` after creation). New "another device"
  contexts keep the project locale `en-GB`, which is what the "follows the person" scenario needs.
- **A-102 Idle server memory on a fresh server** (owner decision 2026-10-13: measure idle RSS on a fresh server): the
  shared test server has served the whole suite before the @perf scenario runs, so its RSS is above 100 MB even though
  it is small when idle. The scenario "The server stays small when idle" therefore uses the new step `When I request
  {string} on a fresh server` (one wording change: `... on a fresh server` appended to the existing request step); the
  assertion step is unchanged. The leak scenario keeps measuring growth on the shared server.
- **A-103 Archive** (owner decisions 2026-10-13 are final; the readings below are mine): (a) a list is "finished" when it
  has at least one item and all are ticked (same as A-94's complement), so an emptied list is not archived. (b) Lists
  without `completedOn` are sorted after those with one, by event date newest first, then title; this is logged in the
  UI nowhere, only here. (c) Search is a plain case-insensitive substring match (no fuzzy, no word split), and an empty
  search shows everything. (d) The template copies title, category and tags only; estimate and recurrence are dropped,
  so the copy never repeats (an undated list cannot). (e) Finished lists older than 365 days without the `done` marker
  (written before this feature) are not found until they are edited once. (f) The setting lives in the "Task lists"
  section of the settings as a two-option segmented control. (g) With "Archive only", a list that is already dated is
  still dated: the setting concerns undated lists only (owner: "finished list without a date"). (h) The Archive refetches
  when it opens and on every sync, like the Open tab.
- **A-110 Theme menu live preview layout** (owner decisions 2026-10-13 are final; the readings are mine): (a) on the desktop
  (>= 900 px) the menu is two columns, the settings on the left and the preview column sticky on the right; the owner asked
  for "side-by-side, preview sticky on the right" and left the width open, so the column is 340 px and the whole menu
  grows to 1100 px; (b) the phone preview is about a third of the viewport height (`max-height: 34vh`) and sits right under
  the menu header; (c) left-handed mode needs no handling (owner).
- **A-111 Live preview content** (my reading): the task list is a small card of real `RewardCheckbox` rows, not
  `TaskListView` or `TaskListCard`, because both depend on the items store and the API ("no API calls, nothing touches the
  real calendar"); the checkboxes are real and inert (no tick animation: pointer events are off). The sample titles are
  catalogue strings, the day names come from `Intl` in the current language. The weekday labels and dates are fixed
  (a Monday to a Wednesday in 2030) so a sample event is never "today".
- **A-112 Live preview testids** (my reading): `theme-preview` (the old card) is gone; `theme-preview-event` is kept and
  now sits on the first sample event, a time-grid block, so "the preview event is drawn as an outline" still reads an
  entry with `data-color`. The sample events do not use the testid `event-chip`, so no step about the calendar's real
  events can match them.
- **A-113 Collapsed state storage** (my reading): "remembered per device in localStorage" is `cal.themePreviewCollapsed`
  (`"1"` collapsed, absent expanded); it is not a setting or preference (it never reaches the server or other
  devices). Collapsed shows the top bar scene strip only (the scene is what a person most wants to see from an
  action in the Scene section), not a bare handle.
- **A-114 Reduced motion** (my reading): "scaled animations only at Full motion" means the effective animation level
  (setting, calm mode and system preference); below Full every CSS animation and transition inside the preview is
  switched off, the scene stays as a still picture.
- **A-120 Canvas board and note size** (my numbers; the owner asked for "larger than the screen"): the board is 4000 x 3000
  canvas units, a note is 240 units wide, zoom 0.3 .. 2 (owner: "such as 0.3-2"); at least 120 px of the board stay in view
  when panning. The server limit for saved places (0 .. 10000) is deliberately larger than the board.
- **A-121 Place fields** (owner: "choose the field names and the size limits"): `cx` and `cy`, integer strings 0 .. 10000, both
  or none; API field `canvas: { x, y } | null`. A pair that is not two integers in range is read as "no place".
- **A-122 Which lists** (my reading of "ALL open task lists"): the same set as the Open tab (all-open: undated plus dated within
  a year either side of today), without the category filter chips (a filtered-out note vanishing from a board you arranged
  by hand would look like data loss).
- **A-123 Dragging** (superseded by owner feedback 2026-10-13, see A-132): a long press (350 ms) anywhere on a note picks it up.
- **A-124 Unsorted order** (my reading): by title, then id, 14 units diagonal offset per note, the last offset shared after
  10 notes; stable so a stack does not reshuffle while ticking. "Top left" is (24, 24) on the board; the default view
  (pan 0, 0, zoom 1) shows it.
- **A-125 Leaving the canvas** (my reading of "after the usual finish feedback"): the note stays 1400 ms after the tick (the
  celebration) plus the support cat's visit when it comes, then disappears; the list is in the Archive at once.
- **A-126 Area defaults** (my choice): new area 320 x 240 units, centred in the view, name "Area" (translated), colour
  from an eight-colour palette by count; minimum size 160 x 120. Membership uses the note's anchor (middle of its top edge:
  x + 120, y + 24); with overlapping areas the topmost (last in the list) wins.
- **A-127 Area storage** (owner: "per person on the server ... one serialisable JSON doc"): `canvas.json`, whole-document
  `GET/PUT`, last write wins, at most 50 areas, written after each finished edit and read when the canvas opens and on
  syncs while nothing is unsaved. Two devices editing at the same moment can overwrite each other (acceptable for one person).
- **A-128 View memory** (owner: "per device in localStorage"): key `cal.canvasView` = `{ x, y, zoom }`; the first visit
  starts at zoom 1, pan 0, 0.
- **A-129 No extra controls** (my reading, "no features beyond what was asked"): no zoom buttons, minimap or "reset view"; the
  only buttons on the canvas are "Add area" and the area editor's. Zoom is pinch and Ctrl+wheel; the plain wheel pans.
- **A-130 Test steps** (my reading): "the Canvas shows the notes A, B" compares the note titles sorted alphabetically (the
  DOM order is not a promise); drags in steps use the mouse (the e2e phones emulate touch, but `page.mouse` events are
  mouse pointers, so the plain-drag path is what runs); the area scenario drops the note at the area's top left + (20, 56).
- **A-131 Translations** (owner): `canvas.*` keys in `locales/<lang>/canvas.ts` for `en`, `de`, `de-x-mainfr` and
  `de-x-coldmirror`; the dialect catalogues are complete for these keys.
- **A-130 Weekend nights** (my reading, owner asked for a simple override and to log the choice): "Different on
  weekends" means the nights before Saturday and before Sunday (Friday and Saturday evening), because people sleep in
  on Saturday and Sunday; all other nights use the main pair. Alternatives weighed: a table with one pair per weekday
  (too much UI, the owner asked for simple) and Saturday and Sunday evenings (the usual late nights are Friday and
  Saturday). The override also applies to the fixed pair that dynamic mode falls back to and compares with.
- **A-131 Night named by wake-up day** (my reading): a night belongs to the day it ends on; its length is the distance
  from bedtime to wake-up on the clock, so `00:00` to `09:00` is a valid weekend pair.
- **A-132 Dynamic uses the whole fixed pair when it would be later** (my reading of "never later than fixed"): when the
  dynamic bedtime is not earlier than the fixed one, both fixed times apply (not a mix); otherwise both dynamic times.
- **A-133 First appointment** (owner: first timed item, timed task lists included, never all-day): the first segment
  that starts on the wake-up day with a time. Not counted: continuation days of a multi-day event, untimed or
  carried-over task lists, hidden calendars. Items not yet loaded are not known; the app loads the day after the shown
  range in the background (dynamic mode only), and until it arrives the fixed times show.
- **A-134 Reminder rules** (my reading): "Bedtime in N minutes" shows N = the minutes left (30 at the exact moment, less
  when the app is opened later); 0 minutes means no reminder; it is not shown once bedtime has started; "once per night"
  is remembered per device (`localStorage` `cal.bedtimeReminded`), not on the server; while the app is hidden nothing is
  shown, and it shows when the app is visible again if bedtime has not started yet. The snackbar stays 10 seconds.
- **A-135 Push hook** (owner: later, structure only): a list of reminder sinks, the snackbar is the first; a push
  notification would add one. Not built.
- **A-136 Bedtime values** (my reading): sleep 1 to 16 hours (offered 6 to 10), lead 0 to 480 minutes (offered 0, 15,
  30, 45, 60, 90, 120), reminder 0 to 240 minutes (offered off, 5, 10, 15, 30, 45, 60); times `HH:MM`; the server
  validates all of it and merges a partial `bedtime` patch into the stored one.
- **A-137 Overlay drawing** (my reading of "dark band with a moon"): translucent scrim colour over the day column (below
  the events, no pointer events), moon icon at the bedtime edge and sun icon at the wake-up edge. The Clock draws a dark
  sector on the dial plate; the Approaching track a dark stretch on the track line (inside its window). In the Week,
  Timeline and Strip views each day shows its own piece; the Timeline's all-day band is not covered.
- **A-138 Bedtime strings** (owner): module `locales/*/bedtime.ts` in all four languages; Coldmirror in the Fresh
  Dumbledore voice, rude only about Harry Potter characters, never sexual and never slurs.
- **A-139 Track without entries** (my reading): the Approaching track is also shown when nothing timed is ahead but a
  night lies inside its window (otherwise the band would never show on a quiet day); it then replaces the "Nothing else
  today" line, like entries do. With the track switched off there is no band on the card.
- **A-132 Long press anywhere** (owner feedback 2026-10-13, the first version was unusable on a phone): a touch long press
  anywhere on a note, including the title, items and checkboxes, picks it up; a short tap still ticks or opens the dialog;
  a touch that moves before the long press does nothing on a note. After a drag the click is swallowed so nothing ticks
  under the finger. `canvas-note-grip` stays only as the top strip with the date, where the e2e mouse grabs a note.
- **A-133 Areas by long press** (owner): a touch long press anywhere on an area (header or body, where no note is on top)
  moves it; a touch that moves before it pans the canvas, because the body is background.
- **A-134 Resize handles** (owner: "same interaction as the calendar's events"): handles show on a long press released
  without moving, and also after a move or a click on the header or when an area is created (my reading: any way of
  touching the area "selects" it); four corner handles of 44 px (the calendar has top and bottom only because its entries
  are one-dimensional); a handle drags at once with no long press; any pointer-down elsewhere or Escape hides them. I did
  not swallow the click of the dismissing tap as the calendar does (a tap on a note's checkbox that hides the handles also
  ticks it): hiding costs no extra tap, and the dismissing tap is mostly on the empty board.
- **A-135 Mouse** (my choice for "show handles on hover or after a click, whichever is simpler"): after a click, not on
  hover (hover does not exist on a phone, so one rule for both): a click on an area's header, or any drag of it, shows
  the handles. A mouse drag moves an area by its header only, because the body must stay available for panning with the
  mouse (areas can be large); touch has no such conflict, as a long press tells a move from a pan.
- **A-136 Tasks filter replaces the calendar chips in the Tasks view** (owner: one filter bar for all tabs, stored per person):
  the top bar's filter button and the global filter row are not shown on `/tasks`; supersedes A-77 and A-122.
- **A-137 "This week"** (owner: "today through Sunday, matching the existing time groups"): date from today through the coming
  Sunday inclusive (on a Sunday: only today). Undated lists never match Overdue, Today, Tomorrow or This week.
- **A-138 Overdue in the Archive** (my reading): the rule is on the date only, so a finished list dated before today matches
  "Overdue" in the Archive; the filter does not look at whether the list is finished.
- **A-139 Filter UI** (owner: compact on the phone; my choice): the When chip with its menu and Clear filters sit left of a
  horizontally scrolling strip of category chips, all in one row. A chip for a category that no longer exists is not shown;
  such a stale id matches nothing and is dropped by "Clear filters".
- **A-140 Dimmed notes** (owner: "e.g. opacity 0.25, not interactive"): opacity 0.25, `pointer-events: none` on the note, so a
  dimmed note cannot be ticked, opened or moved (a long press on it pans nothing either: it acts as background).
- **A-141 Saving** (my reading): each choice is one `PATCH /api/prefs { tasksFilter }` with the whole filter, optimistic
  (the chips change at once, a refusal puts them back with a snackbar), like grouping and sorting.
- **A-142 Create button and the area editor** (owner bug report): on the phone the "+" button slides away (`.away`, as for the
  expanded tray) while the Canvas's area editor is open, through the ui flag `panelOpen`; any later bottom panel of a view
  sets the same flag. Labs views in the navigation bar have icons of their own (clock, timeline, view column).
- **A-143 Long press on item rows** (owner bug report, phone): not reproducible in Chromium's touch emulation, with or without a
  scrollable page (a CDP long press on an item title and on a checkbox picks the note up). Falsified there: a row handler
  that stops or prevents the pointer stream (none exists in `TaskListView`, `RewardCheckbox`, `Chip`), the global
  `button { touch-action: manipulation }` (the same run passes with and without a `touch-action: none` override, and the
  event stream shows no `pointercancel`). What a phone adds and the emulation lacks is the browser's own long-press
  reaction (context menu, text selection, native drag, callout). So the canvas defends against it: every element inside a
  note is `touch-action: none; user-select: none; -webkit-touch-callout: none`, and `contextmenu`, `selectstart` and
  `dragstart` are prevented on notes and areas. The scenarios stay as regression tests.

## Compact, collapsible task list cards (owner 2026-10-13)

- **A-150 Next-task hint removed** (owner: it repeats the first open item): `tasklist-next-task` and the locale key
  `tasks.list.nextTask` are gone in all four catalogues. No scenario or step covered it. The tray's phone "Next: <title>"
  peek (`tasks.tray.next`) and `useTaskListsStore().nextTask` are a different thing and stay.
- **A-151 Add item in the footer row** (owner): `tasklist-add` is a text button with icon and label beside Edit and
  Delete; its field appears above the footer only while adding and goes away again when left empty (as before).
- **A-152 Tighter spacing** (my reading of "a bit"): head, list and footer margins shrink by 4 to 8 px; rows and buttons
  keep their 44 px touch targets.
- **A-153 Collapse state** (owner: "per list per device in localStorage"): one key `cal.tasklistCollapsed` holding a map of
  list id to `true`; lists expanded by default; storage failures only mean the state lasts for this visit.
- **A-154 What stays when collapsed** (my reading of "title row with category colour, progress and date"): the head as it
  is: progress ring, title with category icon, count and the "From" tag of an overdue list. The date is not new text:
  the views already group or tag by date. The "All done" message and the strike-through of a finished title are
  part of the body and head respectively: the strike stays, the message collapses.
- **A-155 Where the chevron shows** (my reading of "where sensible"): the tray, the Tasks view (Open and Archive) and the
  Canvas notes. Not in the expanded list's sheet (`closable`): it is opened to see the items, so collapsing it
  makes no sense. The calendar grid cards are untouched (they already have their own collapsed form).
- **A-156 Collapse all** (owner: one toggle `tasks-collapse-all`): it acts on the lists of the Open tab; the label says
  "Collapse all" until every list shown is collapsed, then "Expand all". It writes the same per-list state, so it
  is remembered too.
- **A-157 Motion** (owner): no height animation at any level, because the body is removed at once; Full motion fades
  the body in and out (opacity), Reduced and Off do not.
- **A-158 Translations** (owner): `tasks.list.collapse`, `tasks.list.expand`, `tasks.view.collapseAll`,
  `tasks.view.expandAll` in `locales/<lang>/tasks.ts` for `en`, `de`, `de-x-mainfr` and `de-x-coldmirror`.
- **A-144 Toolbar buttons per tab** (owner: "decide and log it"): Group/Sort and collapse-all are disabled on Canvas and
  Archive: the Canvas is a free layout without groups, and the Archive's order is fixed (newest finished first) and never
  grouped, so the buttons would do nothing there. The filter button works on all three.
- **A-145 Sheets stay open while choosing** (my choice): the filter sheet is multi-select, so a chip click saves and leaves
  the sheet open; "Done" (or the scrim, Escape, back) closes it. The sort sheet does the same.
- **A-146 Sort label** (owner example "Category · Date ↓"; my reading): the label is "Group · Sort"; the direction is shown only
  when the order is reversed (" ↕"), because the default direction differs per sort key (date earliest first, last changed newest
  first), so a fixed arrow would be wrong for some keys.

## Backup to Google Drive (owner, 2026-10-13; all numbers and names mine)

- **A-180 Bundle and names** (owner: "backup-<sub>.json" with versions as separate files): each version is the file
  `backup-<sub>-<UTC timestamp, 20261012T080000123Z>.json`; the content is `{ schema: 1, created, appVersion, sub, files }`
  with `files` = path relative to `DATA_DIR` -> UTF-8 text. A reader refuses a `schema` it does not know.
- **A-181 Retention and empty data**: the last 7 versions are kept (owner's example, now a constant `BACKUP_KEEP`, logged
  at start). A person with no data files is not backed up, so an empty state can never evict good versions.
- **A-182 Throttle** (owner: ~2 min, 5 min): debounce 2 min after the last change, at least 5 min after the previous
  backup. "Change" = any successful non-GET API call of a signed-in person except backup, auth and test routes (not only
  server-data routes: one middleware instead of a call in every store; unchanged data is skipped by content hash).
- **A-183 Daily timer**: hourly check, first one a minute after start; due when the last backup is 24 h or older, or the
  last attempt failed (this is the "retry on the next trigger"). Daily backups are forced, so a quiet day still gives a
  new version, as the owner insisted (the 7 versions then span 7 days).
- **A-184 Scope on the token** (owner: "detect that the scope is missing on the token"): the granted `scope` string is
  stored next to the refresh token. Tokens from before this feature have none, so everybody re-consents once. The
  re-consent is the ordinary consent (`prompt=consent` already asks again); no separate incremental-auth endpoint.
- **A-185 Never in a backup**: `google-token.json` (secret) and `backup-state.json`. A restore never touches them either.
- **A-186 Shared lists** (coordinator rules, replacing my first "every member" idea): the owner's backup holds the lists
  they own, a member's backup only the ids of their lists, a restore recreates what the restoring person owns. Reasoning:
  one copy of each list, and a restore can never overwrite a list another person owns. Hook: `registerSource({ prefix,
  collect, restore, reload })`; the adapter is `sharedListsBackup.ts`, wired in `createContext`.
- **A-187 Global stores** (owner: ALL data, decided): `settings.json`, `motivation.json`, `people.json` and
  `shared/category-shares.json` go into every person's bundle under `server/`. They are restored only onto a fresh server
  (every one of them untouched, see ARCHITECTURE "Backups"), never over files in use; a restore by button on a used
  server therefore leaves them alone. "Fresh" means untouched, not absent, because the server writes defaults at start.
- **A-188 Manual restore**: newest readable version (a corrupt one is skipped); the safety backup is taken after that
  version is chosen, so pressing the button again undoes the restore. The person's files under `users/<sub>/` are replaced
  (files not in the backup are deleted), then the page reloads.
- **A-189 Auto restore**: only at sign-in, only when the server has no data of the person, the permission is granted and a
  backup exists. When Drive cannot be asked, `restorePending` makes the next backup run retry the restore first; it ends when the retry succeeds, finds nothing, or the person has data again (new data then becomes one more version, the old versions stay).
- **A-190 Upload size**: multipart upload only (limit 5 MB). A bigger bundle fails with an error; resumable upload would be
  the next step and is not needed for text bundles of a few kilobytes.
- **A-191 Sign-in off**: backups need a Google account, so they are unavailable (`available: false`, no Settings block)
  while sign-in is off (sauron, previews).
- **A-192 Status wording**: "Last backup: 12 Oct 2026, 08:00", "No backup yet", "Last backup failed: <reason> (retrying)",
  "Backups to Google Drive are off". `GET /api/backup` never calls Drive, so Settings opens fast and works when Drive is down.
- **A-193 Error codes**: `403 DRIVE_PERMISSION_REQUIRED`, `404 NO_BACKUP`, `502 BACKUP_FAILED` (new codes, not the
  `GOOGLE_REAUTH` banner: a Drive problem must not look like lost calendar access).
- **A-194 Mock Drive**: `MockDrive` over `DATA_DIR/mock-drive.json` with one folder per person; created time from the test
  clock, ids in insertion order; the reset clears it.
- **A-195 Backups run in-process**: timers live in the server process and `unref` so they never keep it alive; a restart
  loses a pending debounce (the next change or the hourly check catches up, the first check being a minute after start).
## Shared lists (owner, 2026-10-14)

- **A-160 Where the data lives** (owner): shared lists are server documents in `DATA_DIR/shared/lists/<id>.json`, one
  file per list, rules in `shared/category-shares.json`, known people in `people.json`; all plain JSON for the later
  Drive backup. I chose one file per list over one big store: independent atomic writes.
- **A-161 Members are subs, picked from people who signed in once** (owner: members are subs, picked from the
  allow-list; my reading): the allow-list holds emails and a sub is only known after a sign-in, so `people.json` maps
  sub to email and name at every sign-in and the picker offers allowed people found there. A person who has never
  signed in cannot be picked yet. In TEST_MODE the allow-list step records its addresses as known people.
- **A-162 Ids** (owner: "choose and log"): a shared list has the id `shared:<id>`, `calendarId` `shared`, and is served by
  the existing task list endpoints, so the web treats both kinds alike. Alternative weighed: a parallel
  `/api/shared/...` surface, which would have meant two code paths in every store and view.
- **A-163 412, not 409** (owner said 409): the API and the conflict UI already use `412 PRECONDITION_FAILED` for stale
  writes; the same status reuses the existing UI as the owner asked.
- **A-164 Category carried on the list** (owner): the list keeps the owner's `categoryId` and a snapshot (name, colour,
  icon). The owner's rename/recolour refreshes it; deleting the category clears it from the owner's shared lists. Only
  the owner can change a shared list's category (a member would otherwise overwrite the owner's category with one the
  owner does not have).
- **A-165 Leave vs delete** (owner): a member's "Leave" removes them from `members`; the list stays with the owner,
  even with no member left (the owner can share it again or stop sharing). Owner-only actions answer a member `403`.
- **A-166 Repeating lists cannot be shared**: the owner's field list has no recurrence and a Google recurring series
  cannot move as one document without losing its rule, so sharing one is refused (`400`) instead of silently
  dropping the repetition.
- **A-167 Category rule timing**: a category share moves the lists of the category when it is switched on and
  creates new lists of the category shared; changing an existing list's category later does not move it, and
  leaving a list does not undo the rule. Sharing a category with another person while one is set re-targets the lists
  already shared through it. Unsharing moves every list of the category that I own back (members lose it).
- **A-168 Moving in and out gives a new id**: "Stop sharing" creates a new Google event (new Google id); a list that
  leaves Google is deleted there only after the shared document was written (and the reverse), so a failure never
  loses a list (at worst a duplicate that is removed again).
- **A-169 One canvas place**: the canvas place is a field of the list, so both people see the note where it was
  last put; each person's areas stay their own.
- **A-170 Sharing while sign-in is off**: there is no second person, so `GET /api/people` is empty and sharing answers `400`.

## Android app and widget (owner, 2026-10-13)

- **A-200 Shell and URL** (owner): a Capacitor Android app loading `http://cal.mordor.lan`, because a TWA needs HTTPS.
  Cleartext only for that host (network security config). App id `lan.mordor.calendar` (my choice, the owner said
  "e.g."), name "Calendar". If the LAN host name changes, `capacitor.config.ts` and the network security config change.
- **A-201 Widget data** (owner, refined 2026-10-13): the widget calls `GET /api/items` itself with the app's session
  cookie (no key); the app-written snapshot supplies theme, language and a fallback. Replaces the owner's first choice
  (snapshot only).
- **A-202 Which tasks** (my reading of "today's task lists"): task lists dated today in the week response. Carried-over
  open lists from earlier days and undated lists are not shown (the widget makes no second request for
  `/api/tasklists/open`).
- **A-203 Multi-day events** (my choice): shown in every day column they cover; a timed event shows its time only on its
  first day, later days show it like an all-day event.
- **A-204 Time zone** (my choice): event times are the wall-clock times of the server's calendar zone (as the API sends
  them); "today" and the week are the device's date. They differ only if the phone is in another zone than the server.
- **A-205 Refresh cadence** (owner: about 30 min): WorkManager periodic, 30 min, only with a network; plus on add, on the
  app's sync (at most every 2 min), on the refresh icon, at midnight and on time or zone change. Android may delay the
  periodic job in Doze or battery saver.
- **A-206 Start time in a column** (my choice): shown only when a column is at least 75 dp wide; on a default 4x2 widget
  the columns are narrower, so rows show the colour bar and title; widening the widget shows the times.
- **A-207 Rows per column** (my choice): as many as the height allows (about 12 dp each, at most 10), the last one "+N".
- **A-208 No snapshot yet** (owner text, my reading): "Open the app once to load your week" shows only while there is
  neither a snapshot nor fetched data; with sign-in off the widget can fetch without the app having run, and then shows
  the week with the default theme.
- **A-209 Signing** (owner: debug-signed or a local keystore): release-signed with a locally generated key
  (`~/.config/calendar-android/`, outside git); without it the debug key is used. The key must be kept: an update over
  an installed app needs the same key.
- **A-210 Open from the widget** (my choice): the app navigates the WebView by loading the URL, which reloads the page
  if the app is already open (about a second); it does not use the router.
- **A-211 SDK level** (my choice): minSdk 26 (Android 8.0), target and compile SDK 36.
- **A-212 `/app.apk` is public** (my choice): no sign-in needed to download it, because the APK has no secrets and the
  route is outside `/api`; with Google sign-in on, anyone on the LAN could download the app, not use it.
- **A-213 Widget = bitmap** (my choice): the widget draws the week as one bitmap (hour grid, blocks, bars); RemoteViews
  cannot place views by time. Text sizes are fixed dp, not the system font scale.
- **A-214 "Like the week view"** (my reading of "same with the lists"): the grid, the all-day band with bars, blocks in the
  item colour, side-by-side/cascade packing (port of `packColumns`), task lists as blocks with checkbox and `done/total` and,
  when tall enough, the open item names; the web's entry style (solid, tinted, outline) and corner shape from the snapshot.
  Not drawn: drag, resize, glow, the "past" strike on lists, category emoji, location and description lines.
- **A-215 Hour range** (my reading of "auto-fits, clamped (e.g. 7-22)"): the grid spans the earliest start to the latest
  end of the week, whole hours, at least 6 h, within 0 to 24, so no item is ever cut off; 08 to 18 for a week without timed
  items. 7 to 22 are example values, not hard limits.
- **A-216 Band height** (my choice): the all-day band takes at most 40 % of the height below the weekday row; rows beyond
  that become "+N" per day, bars beyond it are dropped.
- **A-217 Tapping** (my choice): the whole day column (weekday row to the bottom) opens `/day/<date>`; there is no separate
  tap on a block (the widget cannot know what is under a finger on a bitmap, and a day is the app's own landing for it).
- **A-218 Carried-over lists** (my choice): open task lists from earlier days of the same week are shown on today without
  a time like the web; lists from before this Monday are not (the widget fetches only the week, one request).
- **A-219 Now line** (my choice): drawn at the time of the last redraw; it moves when the widget is redrawn (a data refresh
  every 30 min, a resize, midnight), not every minute.
- **A-220 Size cap** (my choice): the bitmap never has more pixels than the screen (the system limit is 1.5 screens); on a
  large widget the picture is drawn at a lower resolution, not smaller.
- **A-221 Download button in the app** (my choice): "Update the app" hands `/app.apk` to the system browser
  (`ACTION_VIEW`) instead of using `DownloadManager`: no permission, no notification channel code, and Chrome shows progress
  and the install prompt. Only URLs of the calendar's own host are handed over. The label switch is by `window.Capacitor`.
- **A-222 One app, server selectable** (owner, 2026-10-14): the APK works with `https://cal.example.org` (listed first,
  "everywhere (internet)", recommended) and `http://cal.mordor.lan` ("home network only"); the choice is asked once and
  kept in SharedPreferences. Only these two are accepted (no free URL field).
- **A-223 Run-time `server.url`** (my choice): the chosen origin is `server.url` of a config built in `MainActivity`, not
  `allowNavigation` from a local page, because Capacitor injects its JavaScript bridge only for the `appUrl` origin; with
  `allowNavigation` the plugins would not exist on the remote origins. The WebView restarts (`recreate()`) on a switch.
- **A-224 Local pages by links** (my choice): the chooser and offline pages act through links to
  `https://localhost/__server/<action>` intercepted by the `ServerChoice` plugin, not through the plugin API, as they have no
  JavaScript bridge. The offline page also offers "Choose another calendar".
- **A-225 Switching clears the widget** (owner: "clear the widget's cached data and snapshot and refresh"): cached week,
  snapshot and fetch state are dropped on every change; each server keeps its own cookie in the WebView jar, so switching
  back may or may not need a sign-in, depending on the session's age.
- **A-226 Google sign-in in the app: open risk** (my note, not decided): Google blocks OAuth in embedded WebViews, so signing
  in to `cal.example.org` inside the app may be refused. Options if it is: a Custom Tab sign-in that hands the session to
  the app (server and app change), or a server-side one-time login link. Not built; to be tested on a phone first.
- **A-227 APK on the VPS** (my choice): `scripts/vps.sh deploy` copies sauron's `deploy/data/downloads/app.apk` into the
  running app container's `/data/downloads/` (`docker compose cp`), because `/data` there is a named volume; no APK on
  sauron means the VPS's file stays. Version 1.1 (versionCode 2) for this change.

## Missing calendar permission (owner report, 2026-10-14)

- **A-240 Cause** (found): a person who ticked no calendar box got a token without the calendar scope; signing in again
  with it stored the new token, but the running server kept the old per-person provider (old access token) until a restart.
- **A-241 Scope source** (my choice): the token response `scope` is the authority and is stored in `google-token.json`;
  the callback's `scope` query is ignored. Tokens stored before this have no scope and are judged by Google's 403.
- **A-242 Still signed in** (owner instruction): a person without calendar access may sign in; the app says what is
  missing and offers the re-grant instead of "unreachable".
- **A-243 Status 403** (my choice): `CALENDAR_PERMISSION_MISSING` answers 403 (not 401): the session is fine, the grant is not.
- **A-244 Re-grant** (my choice): the existing start route with `include_granted_scopes=true` and `prompt=consent`, so
  Google shows the checkbox again; the banner and the Settings row use it.
- **A-245 Cache** (my choice): the per-person CalendarService (and so provider, OAuth client, calendar list, tasks-calendar
  id) is dropped after the callback stores a token and at sign-out; mock calendar data stays.
- **A-246 Wording** (my choice): the banner quotes the start of Google's checkbox label, which Google may reword.
- **A-250 Left-handed mode on tablets** (owner 2026-10-14: "make it so that left-hand mode also works for tablets like the
  iPad"; the choices below are mine): (a) a tablet is a touch device up to 1366 px: `(pointer: coarse) and (max-width:
  1366px)`; the phone width (< 768 px) counts on its own, so a narrow desktop window stays mirrored as before; a mouse
  desktop above 767 px never changes. (b) ONE condition, published by JS as `html[data-touch]` (name per the owner's
  example; it also stands for the phone width); all CSS uses `html[data-hand='left'][data-touch]`. (c) The rail stays
  at the left. (d) The "+" goes to the bottom left, right of the rail. (e) The tray side panel stays at the right edge; I first moved
  it between the rail and the calendar, but its 380 px push the "+" past the middle of an 820 px screen (the e2e side
  check failed), and floating the "+" over the tray's list would cover rows. Open for the owner: move the tray left and
  accept the "+" over it? (f) The top bar mirrors in a single row. (g) Dialogs on a tablet are
  centred modals, but their action bars mirror like the phone's, for one consistent rule. (h) The tray's inner rows
  (move/fold buttons) are not mirrored on a tablet (the chevron does not exist there). (i) The e2e `tablet` project
  (820x1180, touch, isMobile) runs only `@tablet` scenarios.
- **A-251 Provider before the config** (my choice): `clock.config.provider` is `null` until `/api/config` has answered; the
  mock-only UI (Settings "Reset demo data") shows only for `'mock'`. Alternative: keep `'mock'` as the offline default
  (rejected: a signed-out or failing public server then looks like the demo).
- **A-252 Root cause of the fake demo state** (item 3): `/api/config` is refused with 401 without a session, the clock
  store then kept its default provider `'mock'`, the 401 listener was registered only when App mounted (after the first
  bootstrap calls, which therefore ignored the refusal), and a failed `/api/auth/me` counted as "sign-in is off". The
  listener is now registered before the first call, the default provider is `null`, and a failed check stays
  `unknown` (asked again on the next navigation).
## Shared lists (owner, 2026-10-14)

- **A-160 Where the data lives** (owner): shared lists are server documents in `DATA_DIR/shared/lists/<id>.json`, one
  file per list, rules in `shared/category-shares.json`, known people in `people.json`; all plain JSON for the later
  Drive backup. I chose one file per list over one big store: independent atomic writes.
- **A-161 Members are subs, picked from people who signed in once** (owner: members are subs, picked from the
  allow-list; my reading): the allow-list holds emails and a sub is only known after a sign-in, so `people.json` maps
  sub to email and name at every sign-in and the picker offers allowed people found there. A person who has never
  signed in cannot be picked yet. In TEST_MODE the allow-list step records its addresses as known people.
- **A-162 Ids** (owner: "choose and log"): a shared list has the id `shared:<id>`, `calendarId` `shared`, and is served by
  the existing task list endpoints, so the web treats both kinds alike. Alternative weighed: a parallel
  `/api/shared/...` surface, which would have meant two code paths in every store and view.
- **A-163 412, not 409** (owner said 409): the API and the conflict UI already use `412 PRECONDITION_FAILED` for stale
  writes; the same status reuses the existing UI as the owner asked.
- **A-164 Category carried on the list** (owner): the list keeps the owner's `categoryId` and a snapshot (name, colour,
  icon). The owner's rename/recolour refreshes it; deleting the category clears it from the owner's shared lists. Only
  the owner can change a shared list's category (a member would otherwise overwrite the owner's category with one the
  owner does not have).
- **A-165 Leave vs delete** (owner): a member's "Leave" removes them from `members`; the list stays with the owner,
  even with no member left (the owner can share it again or stop sharing). Owner-only actions answer a member `403`.
- **A-166 Repeating lists cannot be shared**: the owner's field list has no recurrence and a Google recurring series
  cannot move as one document without losing its rule, so sharing one is refused (`400`) instead of silently
  dropping the repetition.
- **A-167 Category rule timing**: a category share moves the lists of the category when it is switched on and
  creates new lists of the category shared; changing an existing list's category later does not move it, and
  leaving a list does not undo the rule. Sharing a category with another person while one is set re-targets the lists
  already shared through it. Unsharing moves every list of the category that I own back (members lose it).
- **A-168 Moving in and out gives a new id**: "Stop sharing" creates a new Google event (new Google id); a list that
  leaves Google is deleted there only after the shared document was written (and the reverse), so a failure never
  loses a list (at worst a duplicate that is removed again).
- **A-169 One canvas place**: the canvas place is a field of the list, so both people see the note where it was
  last put; each person's areas stay their own.
- **A-170 Sharing while sign-in is off**: there is no second person, so `GET /api/people` is empty and sharing answers `400`.

- **A-159 Lighthouse budget** (owner: median of 3 runs, floor 70): the former single run ≥ 90 was not reachable and was
  not stable. On the shared host the identical build scored 0.64-0.84, with TBT between 384 and 1430 ms from host load alone, and
  the first-load work (mount, re-render when items arrive) leaves TBT above what 90 needs. The JS budget stays 150 KB; it is
  measured as Chromium negotiates it (Brotli on localhost/HTTPS, served from the precompressed files; over plain HTTP gzip-9, about 151 KB).
- **A-253 View switcher position** (owner 2026-10-14, final): a Settings option for where the view switcher sits, a
  setting only (no quick toggle). Default = current behaviour (phone bottom bar, desktop/tablet rail). One setting per
  device type, split like `useViewport` (`isPhone` < 768 px vs. the rest; A-250). Options: `bottom` (phone = the bottom
  bar, as now), `top` (M3 tabs row directly under the top app bar; the bottom bar disappears), `rail` (slim side rail,
  also on phones, on the thumb side: right, or left in left-handed mode; desktop/tablet rail stays at the left as now).
  When the phone has no bottom bar the open tasks tray moves to the bottom edge and the "+" floats above it, safe area
  respected. Stored per person (`navPhone`, `navDesktop`), validated server-side. My choices: (a) desktop and tablet offer
  all three options; `bottom` there is the same bar full width below the tray panel (simple, so not withheld);
  (b) both rows are shown on every device, because the choice is per person and follows them; (c) the tabs row shows text
  labels only (icons would not fit 8 Labs tabs at 360 px); (d) the phone rail is 64 px wide (the desktop rail is 80 px).

