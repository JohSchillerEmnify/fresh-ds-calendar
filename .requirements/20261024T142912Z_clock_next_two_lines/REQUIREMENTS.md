# The clock's middle says what comes next on two lines

Owner (2026-10-24), about the clock view ("16:23", below it "Next: Anspielprobe in 3…"): "This is a bit shit. You
can't see when it's happening, how long it is still. It always just says like in 1, in 2, in 4. Maybe you can write the
time below it, like have it in 2 lines."

Owner answer (2026-10-24): scenarios OK; A1 yes (no "Next:"), A2 yes (start time only), A3 yes (tomorrow's first
entry). A4 rejected: timed task lists count in the middle like events, and the wedge stays consistent with the middle.
Built straight through afterwards (owner away; further choices below as assumptions A8–A12).

## As Is

- `web/src/features/labs/clock/ClockView.vue` `nowLine` (today only) takes the Approaching card's text from
  `nowCardModel` (`web/src/features/calendar/timeline.ts`): `calendar.now.next` "Next: {title} in {duration}" or
  `calendar.now.left` "{title} · {left} left", else "Nothing else today". It is one SVG `<text>`
  (`clock-now-line`) under the time, cut by `clip(text, sizing.maxChars + 6)` (`geometry.ts`; `labelSizing` gives
  `maxChars` 14–30, about 16 on a phone, so the line holds about 22 characters).
- Root cause of "in 1, in 2, in 4": the cut takes the end of the line, which is the duration. "Next: Anspielprobe in
  3 h 17 min" becomes "Next: Anspielprobe in 3…": the number is hours, but its unit and the minutes are cut off, and
  the start time is never shown at all.
- `formatDuration`: under 60 min "35 min", whole hours "2 h", else "1 h 20 min" (de: "Min.", "Std."), rounded down
  to whole minutes. "now" ticks once a minute (`stores/clock.ts`), so the line updates every minute.
- Only timed events count (not timed task lists, not all-day events); only today's segments are looked at, so after the
  last event of the day it says "Nothing else today". `focusWedge` (clock.ts) shades to the same target.
- Other days: no middle line. The rings variant (labs-clock-rings) shares the same middle.
- App conventions: event times "12:00 – 13:30" (push notifications), "{day}, {time}"; transition warning "{title}
  starts in {duration}"; Now card "Dentist · 35 min left" / German "Zahnarzt · noch 35 Min.".

## To Be

Today, under the time, the middle has up to two lines:

1. Line 1: the title only (no "Next:" prefix), cut with "…" only when it does not fit.
2. Line 2, never cut:
   - next event today: `{start} · in {duration}` — "19:40 · in 3 h 17 min" / "19:40 · in 3 Std. 17 Min."
   - running event: `until {end} · {left} left` — "until 10:00 · 30 min left" / "bis 10:00 · noch 30 Min."
   - nothing else today, a timed event tomorrow: `Tomorrow {start}` — "Tomorrow 09:00" / "Morgen 09:00", no wedge.
3. Nothing timed today or tomorrow: one line "Nothing else today" / "Heute nichts mehr", no wedge.

The day/week Now card and the Approaching track are unchanged (they have the room; the clock gets its own texts).
Names on the dial keep clear of both middle lines.

## Requirements

1. Today the clock's middle shows the next or running event's title on its own line.
2. Below it, a second line shows the start time and the time until it (next) or the end time and the time left
   (running), in the app's duration wording, never cut.
3. The title line is cut with "…" only when it is too long for the middle.
4. The second line updates every minute (rounded down, as the Now card).
5. When nothing timed is left today, the middle names tomorrow's first timed event with "Tomorrow HH:MM"; with
   nothing tomorrow either it says "Nothing else today" on one line. No wedge in both cases.
6. All-day events never stand in the middle. Timed task lists do, as running or next entries like events (owner);
   the wedge shades to whatever the middle names (none for tomorrow's entry).
7. English and German wording as above.
8. No name on the dial overlaps either middle line.

## Acceptance Criteria

1–2. Outline "Today the middle names what is running or comes next, when, and shades the time until then" (06:55,
     08:00, 08:37, 09:30).
3. "A long title is cut short in the middle, its time never" (@mobile, the owner's case: 16:23, 19:40 event); short
   titles in the outline are matched exactly (no "…").
4. "The time under the title counts down as time passes".
5. "When nothing else comes today, the middle names tomorrow's first event"; "When nothing timed comes today or
   tomorrow, the middle says so on one line".
6. Both scenarios of 5 contain an all-day event that is ignored.
7. Outline "The middle speaks German".
8. "no two names on the clock overlap" in the long-title scenario, now also against `clock-now-when`; existing crowded
   scenarios of labs-clock and labs-clock-rings keep passing.

## Testing Plan

- Unit (vitest): a pure `clockMiddle(segsToday, segsTomorrow, nowMin)` returning `{ title, when } | { line }` — next,
  running, several running (the one ending first, as now), tomorrow, nothing, all-day ignored, minute rounding.
- e2e (targeted, `--grep` the scenario names above, mobile and desktop) + the existing crowded-name scenarios.
- Visual: there are no clock pictures yet (`e2e/snapshots/mobile` has none), so no @visual scenario is added; the
  build still takes screenshots of the clock at phone size and looks at them (two lines, no overlap with the time or
  names).

## Implementation Plan

1. `clockMiddle` in `features/labs/clock/clock.ts` + i18n keys (`calendar.clock.nextAt`, `untilLeft`, `tomorrowAt`
   in en/de; fun variants fall back to de) — unit tests first.
2. ClockView: two `<text>` lines (`clock-now-line`, `clock-now-when`), title clipped, second line unclipped;
   `middleBox` keeps names clear of both — e2e scenarios above.
3. Tomorrow's segments read from `items.byDate` for date+1 (already loaded with the visible range? to check; if not,
   the line falls back to "Nothing else today" until loaded).
4. e2e step changes (STEPS.md already updated), `verify`, targeted e2e, screenshots looked at. PR boundary: one PR.

## Assumptions (open choices — owner to confirm)

- A1 Line 1 drops the "Next:" prefix so the whole width goes to the title; line 2 "in …" / "left" says next vs
  running. Alternative: keep "Next: Anspielprobe" (costs 6 characters, 14 in German "Als Nächstes: ").
- A2 Line 2 shows only the start, not the range "19:40 – 22:00": the range plus countdown ("19:40 – 22:00 · in 3 h
  17 min", 29 characters, 33 in German) does not fit the phone's ~22 characters without cutting.
- A3 Tomorrow's first timed event is named when nothing else comes today ("Tomorrow 09:00", no countdown, no wedge),
  although it is not on today's dial. Alternative: keep "Nothing else today".
- A4 REJECTED by the owner: timed task lists count, and the wedge follows the middle.
- A5 Running event line 2 "until 10:00 · 30 min left" (end time first, like the next case's start time first).
- A6 An event running past midnight shows "until 00:00" for its end on this day's dial (no special case).
- A7 The day/week Now card keeps its one-line texts; only the clock (both variants) changes.
- A8 A task list in the middle is named by its title only (no "1/2" count, unlike its arc label); an untitled list is
  "Task list".
- A9 Tomorrow is loaded by a background prefetch of [tomorrow, day after) while the clock shows today
  (`items.prefetch`); the cached range is not re-polled, so a change to tomorrow made elsewhere shows after the next
  load of that range (or a reload). Accepted for a Labs view.
- A10 Line 1 (title) is on-surface, weight 600; line 2 on-surface-variant, weight 500, tabular digits; both at the
  name font size, 1.3 em apart. Line 2 is never clipped, even in German ("bis 10:00 · noch 1 Std. 20 Min.").
- A11 Coldmirror gets its own short texts ("bis {end} · noch {left}, yo", "Morgen {start}, yo"); Fränggisch falls
  back to German.
- A12 The day/week Now card (`nowCardModel`) is untouched; the clock has its own `clockFocus` / `clockMiddle`.

## Implementation notes

- `web/src/features/labs/clock/clock.ts`: `clockFocus(today, tomorrow, now)` (running ending first → next today →
  tomorrow's first; timed events and timed task lists, first segments only), `clockMiddle(focus, now)`, and
  `focusWedge` now built on `clockFocus` (optional `colorOf`, the view passes the category-aware `itemColor`).
- `ClockView.vue`: `middle` replaces `nowLine`; `clock-now-line` (title, clipped) and `clock-now-when` (never
  clipped); `middleBox` keeps names clear of both lines; tomorrow prefetched while today is shown.
- i18n: `calendar.clock.nextAt` / `untilLeft` / `tomorrowAt` in en, de, de-x-coldmirror.
- Tests: unit `web/test/calendar/clock.test.ts` (focus, wording, wedge with task lists); e2e labs-clock (+2 task-list
  examples), STEPS.md updated; @visual: 3 new clock pictures (`clock-next-long`, `clock-running-dark`,
  `clock-tomorrow-de`) with a new `clock` region.
