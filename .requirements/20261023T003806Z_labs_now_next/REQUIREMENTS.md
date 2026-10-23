# Labs: Now / Next deck

Source: owner's night request (2026-10-22/23) to build idea #1 of `docs/proposals/2026-10-23-calendar-view-ideas.md`
as an experimental Labs view, default off. Research basis: `docs/ADHD-RESEARCH.md` R3 (Now card with time left and a
shrinking bar), R13 (next small task), S6/S7 (externalise time at the point of performance).
The owner is asleep; every decision below that the request does not settle is marked **Assumption**.

## As Is

- Labs views (clock, timeline, strip, zoom, horizontal) live in the registry `web/src/features/labs/labs.ts`; each entry
  gets a switch in Settings → Labs and, when on, a flask-marked tab in the view switcher. Routes are in
  `web/src/router/index.ts`; `useNav.switchView` and `labPath` route to them (the timeline has no date).
- The Approaching card (`NowCard.vue`, `nowCardModel` in `features/calendar/timeline.ts`) is a slim line above the
  calendar views: running event + time left + shrinking bar, and the approach track / "Next:" line.
- The app clock (`stores/clock.ts`) is the one minute ticker; it pauses while the page is hidden.
- There is no view that shows only "now / next / later" in big, thumb-sized cards.

## To Be

A new Labs view **Now** (`id: 'now'`, route `/now`, no date, **off by default**). On a phone it fills the screen
with a stack of three cards; on a wide screen the same stack is a centred column.

1. **Now card** (big):
   - an event running now: its title, the time left in words ("35 min left") and a bar that shrinks as time runs out;
   - else the first open task list of today: its title and its first unticked item;
   - else "Free until 14:00" (the next entry's start), or "Free for the rest of today" when nothing is left.
2. **Next card**: the next entry of today with a time (event or task list): title, "in 1 h 20 min", start time.
   Without one: "Nothing else today".
3. **Later today card**: folded, saying "N more"; a tap unfolds it into a compact list "HH:MM Title" of the remaining
   timed entries of today after the Next one. Not shown when there are none.
4. A tap on the Now card (event or task list), the Next card, or a line in Later opens that entry exactly like a tap
   elsewhere (`openItem`).

## Requirements

1. R1 — The registry has a Labs view `now` (label "Now"), off by default; Settings → Labs lists its switch; switched on,
   the view switcher offers it like the other Labs views.
2. R2 — `/now` shows today (app clock) whatever date the other views show; it loads today's items itself.
3. R3 — Now card for a running event: title, time left in words (same wording as the Approaching card,
   `formatDuration`), progress bar showing the share of the event still left.
4. R4 — Now card without a running event: the oldest open task list of today (carried-over first), among those
   without a time or whose time has come; shows its title and first unticked item.
5. R5 — Now card with neither: "Free until <next start>", or "Free for the rest of today".
6. R6 — Next card: the first timed entry (event or task list, carried-over lists at their time) starting after now:
   title, "in <duration>", start time; else "Nothing else today".
7. R7 — Later card: folded by default with "N more"; unfolded, the remaining timed entries after Next as "HH:MM Title";
   absent when N = 0.
8. R8 — Tapping Now (entry), Next, or a Later line opens the entry like elsewhere.
9. R9 — Live: updates with the app clock's minute tick (no own timer; pauses while hidden with it). Calm/reduced
   motion: the bar does not animate.
10. R10 — Theme tokens only (light + dark); all strings in en, de, de-x-coldmirror, de-x-mainfr.

## Acceptance Criteria

- R1: unit test — `visibleLabsViews(true, {})` does not contain `now`; with `{ now: true }` it does. e2e: Labs on →
  "Now" not offered; after switching the Labs view "Now" on → offered (scenario 6).
- R2: e2e opens `/now` with a frozen clock and sees today's entries.
- R3: unit — Dentist 14:00–15:00 at 14:25 → running Dentist, 35 min left, 58 % left. e2e scenario 1.
- R4: unit — open list shown, done list skipped, future-timed list not on Now, carried-over older list wins. e2e scenario 3.
- R5: unit + e2e scenario 4 ("Free until 14:00").
- R6: unit — next = first start > now, task lists with time included; e2e scenario 2 ("in 1 h 55 min", 16:20).
- R7: unit — later = rest after next; e2e scenario 5 ("2 more", unfolded "17:00 Gym, 19:00 Dinner").
- R8: e2e scenario 1 — tap on the Now card → the event dialog is open.
- R9: code review (only `clock.minutesNow` is read; CSS `html[data-motion='off'|'reduced']` drops the transition).
- R10: `pnpm --silent verify` (includes the i18n check); phone screenshots in light and dark looked at.

## Assumptions (owner asleep)

- A1 — Tab label "Now" (de "Jetzt"): short enough for the bottom bar, and it lets the existing Labs steps
  (`settings-labs-view-<label lowercased>`) address it. The proposal's name "Now / Next deck" stays the feature name.
- A2 — "Running" means a timed, single-day event, as in the Approaching card (`nowCardModel`: start ≤ now < end, the
  one ending first). Multi-day bar events and all-day events are not "running" (same as the Approaching card).
- A3 — "First open task list of today" = R13's "oldest open list for today": open (an unticked item), on today (carried-over
  lists included), untimed or with its time already come; oldest date first, then the day's order. A timed list later
  today is shown in Next/Later instead.
- A4 — Next/Later list every entry with a time today (events and task lists, as the approach track does), all-day and
  untimed entries left out. Only today: "free until" does not look into tomorrow ("Free for the rest of today").
- A5 — Minimum event length does not apply: it changes how entries are *laid out* in time, "its real times never change",
  and the deck lays nothing out in time; the time left and "in …" use real times.
- A6 — Left out of this slice (proposal extras): tick box on the Now card, swipe-up preview, long-press "remind me",
  haptics, "leave by", bedtime in the Later card. They need the item components / notification code another track owns.
- A7 — The Later card's fold state is not remembered (folded on every visit); no swipe navigation on `/now`
  (`noSwipe`, there are no periods to move through).
- A8 — Filters from the URL and hidden calendars apply, as in the Approaching card (`useDaySegments`).

- A9 — Known limit (review): when two events overlap, the one ending first is Now (Approaching card rule) and the
  other, already started, is on no card until the first ends. An "also now" line is a follow-up for the owner to decide.
- A10 — Known limit: like `/timeline`, the top bar keeps its period title and prev/next/Today on `/now`; in the day view
  they stay on `/now` (always today). Hiding them for date-less Labs views is a shell change left for the owner.

## Testing Plan

- Unit (vitest): `web/test/nowNext.test.ts` for the pure model `nowNextModel(segments, nowMin)` — running / task list /
  free / next / later cases incl. A3 edge cases; `web/test/labsViews.test.ts` updated for the new default-off view.
- e2e (playwright-bdd, mobile + desktop): `spec/features/labs/labs-now-next.feature`, 6 scenarios with frozen clock.
- Regression: the three Labs switch scenarios of `labs-clock.feature`; `@visual` scenarios unchanged.
- Visual: own phone screenshots in light and dark, looked at.
- Gate: `pnpm --silent verify`.

## Implementation Plan

1. Spec: feature file + STEPS.md entries; `python3 e2e/scripts/check-steps.py` → 0 problems.
2. Model: `labsNowNext` in `docs/architecture/models/web.c4`; `npx -y likec4@1.47.0 validate docs/architecture`.
3. Unit tests (red) for `nowNextModel` and the registry default → implement `features/labs/nownext/nowNext.ts` (green).
4. Registry entry + route + `labPath`/`switchView` + i18n (4 locales) → `NowNextView.vue`.
5. e2e steps (red against no view) → view → green on mobile and desktop; Labs switch scenarios.
6. `@visual`, own screenshots (light/dark), `pnpm --silent verify`.

PR boundary: all of the above is one reviewable unit (one experimental view behind a default-off switch).

## Implementation notes

- Model `web/src/features/labs/nownext/nowNext.ts` reuses `nowCardModel` (running rule) and the approach track's
  `timedToday` (now exported) for timed entries; the view reads only `clock.minutesNow` (the one ticker).
- Code review (subagent) applied: task-list colours via `useTaskCategories().itemColor`; an event across midnight
  counts its real time left/share/end (unit test); the Now card is a `div` whose title button covers the card, so the
  progress bar stays exposed to screen readers; `loaded` resets on a day turnover; `aria-controls` on the Later toggle;
  the bar step polls. Overlap (A9) and the top bar (A10) recorded as known limits.
