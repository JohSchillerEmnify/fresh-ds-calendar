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
- **A-32 Budgets** (owner update): initial JS ≤ 150 kB compressed, month view rendered ≤ 2 s, Lighthouse mobile ≥ 90
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
  and garden style Single plant (default) / Sunflower field / Off, for the owner's A/B comparison.
- **A-62 Sunflowers**: one per 40 growth points, max 24 stored; 12 visible on phones (< 600 px), 24 on wider screens.
  They share the plant's mood and never decrease.
- **A-63 Butterfly**: once per browser-tab session (`sessionStorage`), only at motion level Full and with ≥ 1
  sunflower. Its landing flower is random (not asserted in tests).
- **A-59 Year view density** buckets: 0, 1, 2–3, ≥ 4 items per day.
- **A-60 Month picker** jumps the current view to the picked day. It does not switch views.
- **A-61 Phone navigation** has four destinations (Year, Month, Week, Day). The open tasks tray sits above the
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
  visible wins (the theme's if it was not None, else the old top bar setting). "Sunflower field" still needs garden
  style "Sunflower field" to show. "Season" stores today's season scene, not a standing "follow the season" value.
- **A-81 Library and version** (owner decision 1, 2026-10-13): vue-i18n 11.4.12 (exact pin, released 2026-09-16, the
  newest release at least two weeks old; 11.4.13/14 and 12.0.0-alpha are newer), Composition API (`legacy: false`),
  with the build flags `__VUE_I18N_LEGACY_API__`, `__VUE_I18N_FULL_INSTALL__` and `__INTLIFY_PROD_DEVTOOLS__` off
  (vue-i18n's own optimisation advice). The plugin is not installed on the Vue app: UI code uses our typed `t()`.
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
  "bassd", "etz", "amal", "gud", "Eisdellunga"); Coldmirror uses "Schinken!", "BÄMbus!", "Was ist das für 1 …", "du
  Oberpflaume", "Eulen. Eulen everywhere." and never "Ich bin voll geil". Both are partial on purpose.
- **A-90 Settings row**: "Language" sits at the end of Appearance (below Theme). The Automatic option is translated;
  the language names are not (each in its own name). Choosing saves through `PATCH /api/prefs` like the other prefs.
- **A-91 First-load size**: vue-i18n adds about 18 kB gzip to a shared chunk that the first load preloads. The
  size-limit "initial JS" check measures only `index-*.js` and stays at 64 kB of 75; "all JS" was already above its
  152 kB limit before this slice. Possible later saving: pre-compile messages and use the runtime-only build.
- **A-92 Test step "the browser language is"**: an init script on the current context overrides `navigator.language`
  and `navigator.languages` (a Playwright context cannot change its `locale` after creation). New "another device"
  contexts keep the project locale `en-GB`, which is what the "follows the person" scenario needs.
