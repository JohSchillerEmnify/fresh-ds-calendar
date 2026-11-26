# Item search (issue 190)

Status: built; every proposal below is an assumption for review, and only the quoted words and pick labels are the owner's. Feature file: `spec/features/views/item-search.feature`.

## As Is

- No way to look for an event or a task list across the calendar. Existing searches: the settings search
  (`spec/features/app/settings-search.feature`; `normalize()` and substring matching in
  `web/src/components/settings/catalog.ts`) and the Archive search (`tasks-archive.feature`: title and item titles of
  finished lists, server-backed list from `GET /api/tasklists/archive`).
- Item types (`shared/api.d.ts`): `CalendarEvent` (title, description, location, calendar, date/time, also birthdays and
  holidays) and `TaskList` (title, optional date, `TaskItem[]` with `title`, ink items with an empty title).
- Ink items have no text; the spec says (G3, handwritten-lists.feature) that ink is not searchable and an ink list is found
  by its title only.
- The device copy (ADR 0025, `last-known-state.feature`): events from a year back to a year ahead of today, all task
  lists, calendars, settings. Days further away
  load from the server and are not kept. Verified in code: `windowOf` in `web/src/lib/deviceData.ts` keeps today-365 up to, not
  including, today+366 (the last day is today+365; ADR 0025). ADR 0023's +-4 weeks snapshot is the older design.
- The day route is `/${view}/${date}` (`web/src/router/index.ts`), so a day is `/day/2026-12-03`.
- Server: `GET /api/items?from&to` returns events and task lists of a range (max 100 days); no text search exists. The
  Archive list is `GET /api/tasklists/archive`.
- The top bar is `AppTopBar.vue`. Kit components used: `SearchField`, `AdaptiveSheet`, `IconButton`.

## To Be (proposal)

A search icon in the top bar opens a search sheet. Typing lists matching events and task lists from the device copy, ordered
by a fixed rule; choosing a result opens that item on its day. Works offline.

## Owner decisions

1. Owner (issue 190), verbatim: "kalender should have a search to look for items."
2. Searched, ask-box pick: "Titles, notes, place, items (Recommended)" (my reading: event title, notes, place; task list title and
   its items; ink not searchable, G3; an ink list is found by its title).
3. Range, ask-box pick: "Plus older via server" (my reading: device copy first, offline; plus a "search older" button that asks [button REPLACED by 19]
   the server when online).
4. Tap a result, ask-box pick: "Go there and open it (Recommended)". As a requirement (my reading, P6): the search
   closes, the calendar moves to that day and the event or list opens; an undated list opens in the Tasks view.
5. Entry, ask-box pick: "Top bar icon (Recommended)". As a requirement (my reading, P7): a search icon in the top bar,
   and in the side-menu layout a search row at the top of the menu.
6. Position, owner on the mockup, verbatim: "maybe rather in this position". My reading: the search icon sits right after the date, before
   the Today button (date, search, Today, filter, settings).

7. Performance, owner, verbatim: "and for this search we should pay attention to performance!" and, as the
   clarification: "it should be reasonably performant." (My reading: reasonable budgets in line with the existing
   `@perf` tests, not aggressive targets.) And on waiting while typing, verbatim: "with a short wait while you type not
   necessary when running locally." (My reading: no debounce for the device search; results update on every keystroke.)

8. Order, ask-box pick: "Upcoming first (Recommended)".
9. Matching, ask-box pick: "Typos allowed". (My reading: close spellings match too, e.g. "advsor" finds "advisor".)
10. Birthdays and holidays, ask-box pick: "Yes, like events (Recommended)".
11. Hidden calendars, ask-box pick: "Searched, marked". (My reading: results from calendars switched off in the filter bar carry a
    "hidden" mark.)
12. Shared lists, ask-box pick: "Yes, with 'shared' mark (Recommended)".
13. Result count, verbatim: "performance rules still apply, load the first ones on screen and then you can maybe load
    more on scroll." (My reading: the first screenful is rendered and more is appended on scroll; no "show more" button.)
14. (REPLACED by 18) Server search bound, ask-box pick: "5 years, 100 results (Recommended)".
15. Say it, verbatim: "but not silently, we need to tell user".
16. Matcher, ask-box pick: "MiniSearch, typos from 4 letters (Recommended)". Only that label is the owner's. My
    proposals on top of it (not decided): the index is built once in small chunks when the search first opens, not
    persisted, kept in step with sync; one typo forgiven in words of 4 or more letters; 3-letter words match by prefix
    ("tea" finds "team") but get no typo tolerance (expected; proven by the scenarios when built).
17. Reach wording (P11), verbatim: "yeah fine." My reading: it approved the device line and the button texts of that time; only the device line still applies (see decision 21 for the new ones).
18. Server search range, ask-box pick: "All time, nearest 100 (Recommended)" (my reading: Google events.list `q`; the 100 nearest to today
    first, more loaded on scroll; still not silent, decision 15). Sources, read 2026-11-26: the events.list reference
    (https://developers.google.com/workspace/calendar/api/v3/reference/events/list: q fields, maxResults up to 2500,
    nextPageToken, orderBy) and the quota guide
    (https://developers.google.com/workspace/calendar/api/guides/quota: 600 requests per minute per user, 10,000 per
    minute per project, sliding window; 403/429 with truncated exponential backoff).
19. Automatic, verbatim: "automatic if user reaches end of local events in scrolling." (My reading: no button; online, the server search
    runs by itself at the end of the device results and its results append; offline, the end of the list says the rest needs
    a connection.) This replaces the button of decision 3 and its texts (the button and "5 years" texts of decision 17 no
    longer apply; the device line of decision 17 still does).
20. Order of the appended block, ask-box pick: "Appended below (Recommended)" (my reading: device block first, a divider line, then the
    beyond-device block, nearest to today first).
21. Texts (a) to (e) of P11, ask-box pick: "OK as written" (my reading: the five en and de pairs under P11).
7a. On matching speed, verbatim: "fzf for example is super fast. (as an example, not as a library to implement)".

Everything not listed (shortcut, the server search's bound and wording, mark wording) is a proposal.

## Proposals (all unconfirmed)

P1. Searched fields: event title, description (notes), location; task list title and task item titles. Not the
    calendar name, not ink (consistent with G3, which the spec states), not the placeholder "Handwritten item".
P2. Matching: accents, capitals, hyphens and spacing ignored (as the settings search's `normalize()`), every word of the
    query must match (any order), each word allowing a typo (decision 9; matcher in P10). Expected behaviour, proven by the
    scenarios when built. The function is `web/src/lib/normalize.ts` (not `shared/`: the server and widget do not search text);
    consumers: web item search and settings search.
P3. Scope: first the device copy (events a year back to a year ahead, all task lists) with a note of the covered
    range. Birthdays and holiday events count as events.
P3a. (REPLACED by decisions 18 and 19; the text below was the button design.) Online, a "search older and later" button asks the server for events outside the
    device window and merges them in the same order. Offline the button is absent (proposal; alternative: disabled
    with a hint). One button for both directions (alternative: two). New endpoint `GET /api/search` (proposal in
    `spec/API.md`, per person, capped at 100 results and 5 years, not kept on the device); alternative: reuse
    `GET /api/items` in 100-day chunks (many requests, no filtering on the server). Whether Google's `events.list`
    `q` can back it is unverified.
P4. Order: owner decision 8 "Upcoming first": from today onwards nearest first, then the past newest first, undated lists last (the tail is my wording).
P5. Result row: kind icon, title, date and time (nothing for undated), a second line naming the matching task item or
    the matching note/place text; "· Shared" text suffix on the second line.
P6. Tap: the sheet closes, the app goes to the item's day and opens the event dialog or the task list; an undated list
    opens in the Tasks view.
P7. Entry: a search icon button in the top bar right after the date, before Today, where the bar has a Today button (owner decision 6); the side-menu layout gets it in
    the side menu top, not the bar.
P8. Items of calendars switched off in the filter bar are found and carry a "hidden" mark (decision 11); shared lists are found with their "shared" mark (decision 12).
P9. Overlay: `AdaptiveSheet` with the m3 `SearchField` on top; Escape closes. All strings in every locale (en, de and
    the two `de-x-*` variants), texts per `docs/UI-TEXTS.md`.

## Telling the user the reach (owner decisions 15, 17, 18, 19)

Decided (17): the device line "Searching 26 Nov 2025 – 26 Nov 2027" / "Suche vom 26.11.2025 bis 26.11.2027", from `windowOf(today)`
(today-365 up to, not including, today+366, i.e. the last day is today+365), unchanged. The button, its supporting line, "Searched 26 Nov 2021 – 26 Nov 2031"
and the "More than 100 matches" texts are REPLACED (no button, no 5 years).

P11 (the decided texts under decision 21 "OK as written"; en then de; UI-TEXTS rules: no "server", passive status in German, real typography; all are lines
under the device results, in `item-search-beyond`):
- (a) while the server search runs: "Searching all dates …" / "Alle Daten werden durchsucht …"
- (b) after it ran: "Searched all dates" / "Alle Daten durchsucht"
- (c) a page of 100 is full and more can load: "Showing the 100 closest to today first. More appear as you scroll." /
  "Zuerst die 100 Treffer, die heute am nächsten liegen. Weitere erscheinen beim Scrollen."
- (d) offline at the end: "Older and later events need a connection." / "Ältere und spätere Ereignisse brauchen eine Internetverbindung."
- (e) Google's rate limit stopped it: "Searching all dates did not finish. Scroll to the end again in a moment." /
  "Die Suche in allen Daten ist nicht fertig geworden. Scrolle gleich noch einmal ans Ende."
- Marking beyond-device rows: no mark per row; line (a) or (b) is the divider line above the appended block (decision 20).
- Typos beyond the device: Google's `q` is probably exact (unverified); proposal: tell the user nothing about it, as a missed
  typo just shows nothing more; revisit if it matters after testing against Google.

## Performance (owner decision 7)

Conventions followed (`spec/features/app/performance.feature`, `e2e/STEPS.md`): `@perf` runs only in the mobile
project, serially, and also in the nightly full e2e job; the budgets are ceilings with room for a busy machine; CPU is
throttled 4x as a phone ("the phone's processor is 4 times slower"), long tasks are measured with `PerformanceObserver`;
the first-load JavaScript ceiling stays at 220 KB compressed (the existing scenario, not raised).

Heavy-user fixture (derived from the "busy month": 500 entries in 42 days, about 12 a day; this fixture is a little below, about 11 a day): about 8 000 events and 700
task lists with about 3 800 items in the device window, 12 500 searchable texts.

Scenarios (`@perf`): results of a typed query within 500 ms at 4x slowdown, no task over 300 ms and long tasks
under 1000 ms together, with no debounce, so every keystroke searches (the busy-month scenario allows 800 and 3 500 for a much heavier render); opening and closing the
search 50 times grows heap under 15 %, nodes under 10 % (the existing leak limits).

### Matcher: how fzf works, and which JS option follows the idea (owner decisions 7, 7a, 9)

fzf (source: `src/algo/algo.go` of github.com/junegunn/fzf): "omission or mismatch of a character in the
pattern is not allowed" (my reading of that line: it forgives a left-out letter in the query, "advsor" in "advisor",
but not a wrong or swapped one).

Candidates looked at (versions and licences from `npm view`, 2026-11-26): fzf-for-js `fzf` 0.5.2 (BSD-3-Clause), uFuzzy
`@leeoniya/ufuzzy` 1.0.19 (MIT), MiniSearch 7.2.0 (MIT), Fuse.js 7.5.0 (Apache-2.0). The owner picked MiniSearch (decision
16). Proposed settings (to be checked with a unit test when built): `prefix: term => term.length >= 3`,
`fuzzy: term => term.length >= 4 ? 1 : false`, `combineWith: 'AND'`, so a word of three letters is expected to match the start of a word
and to get no typo tolerance (proven by the scenarios when built). MiniSearch's `fuzzy` option takes an edit distance (Levenshtein; its type docs in `index.d.ts`),
The build and the per-keystroke time are budgeted by the `@perf`
scenarios, which are the check.

Pipeline: the index is built once when the sheet first opens, with its own `updateAsync` (chunks of 150 documents, `add` and `discard` per changed item; so no task passes the
long-task budget), kept in step with the device copy (not
read from IndexedDB per keystroke); no debounce (owner decision 7); the matcher filters, then P4's order (upcoming first,
then past newest first, undated last) is applied; the list renders the first screenful (about 20 rows) and appends the
next block while scrolling (decision 13). No lazy-loading to shrink size (AGENTS.md "budgets are ceilings, not
targets"); the 220 KB first-load scenario stays unchanged. The server search (decisions 18 and 19) is a network request, outside these
budgets. Typo tolerance on the server's search: unverified, to settle against Google's `events.list` `q` docs.

## Open questions

Decided: what is searched, range (device, then all dates on scroll to the end: 18, 19), tap, entry and position, order, typos, birthdays and
holidays, hidden calendars, shared lists, result loading, performance. Still open (each with my recommendation in the
report): (both still PROPOSALS) a failed search retries only on the next scroll to the end, and no automatic retrigger when the
connection returns; also a desktop shortcut (none), a minimum query length (1 character), and the "hidden" and "shared" mark wording.

## Testing plan

- Unit (Vitest, `web/test`): the matcher (normalisation, all words, fields), the ordering function, the range from
  today.
- e2e: the scenarios of `item-search.feature` (mobile and desktop), including offline; `@visual`: the sheet empty, with
  results, with no match, phone size, light and dark.
- `python3 e2e/scripts/check-steps.py` at 0 problems (done for the spec).

## Implementation plan

1. Answer the open questions; update the spec accordingly and drop `@backlog` scenario by scenario.
2. `normalize` lives in `web/src/lib/normalize.ts`, not `shared/`: only the web (item search and settings search) matches text, the server and widget do not, so there is no second consumer to share it with. Unit tests for the matcher (`ItemIndex`) and the order (`orderHits`).
3. Web store/composable reading the items store and the device copy (events from the held ranges plus all task lists);
   check where an offline all-lists copy lives (Tasks view store) and reuse it.
4. `ItemSearchSheet.vue` on `AdaptiveSheet` + `SearchField`; the top bar button with an i18n label; navigation on tap.
5. i18n keys in all locales, `docs/UI-TEXTS.md` check, `pnpm i18n:scan`.
6. Step implementations in `e2e/steps/`, `@visual` baselines (looked at, phone size), CHANGELOG bullet, `pnpm verify`.
