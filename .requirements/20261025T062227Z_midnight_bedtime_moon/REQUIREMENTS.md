# A bedtime at midnight belongs to the evening before

Owner (2026-10-25, screenshot of the clock at 01:12 on Sunday): "There are two bedtimes on that clock."
Owner picked option A: a bedtime at exactly 00:00 belongs to the evening before.

## As Is

- Weekend times 00:00 → 09:00 (the defaults once "different on weekends" is on), weekdays 23:00 → 07:00.
- `clipToDay` (`web/src/features/bedtime/bedtime.ts`) marks a night as starting on a day with `w.start >= dayStart`.
  A night that starts at exactly 00:00 therefore gets its moon at 00:00 of the next day.
- Result: Sunday's clock and day column show two moons (00:00 of Saturday night, 23:00 of Sunday night); Saturday
  (and Friday) show no evening moon at all. DST plays no part (wall-clock model; 2026-10-18 is the same).
- `BedtimeDial` / `BedtimeColumn` ask for the windows of `date .. date+1`; `bedtimeWindows` drops a night that starts
  exactly at the end of that range, so the column of Saturday never even sees the night that starts Sunday 00:00.

## To Be

- A night starting at exactly 00:00 of day D+1 shows its moon (and the bedtime edge line) at 24:00 of day D: the top
  of the Clock dial, the bottom edge of the day column (Day, Week, Timeline, Strip). Day D+1 shows the band
  00:00–wake and the sun, without a moon.
- Bands are unchanged: no empty "24:00-24:00" band piece appears on day D.
- The Approaching track, the reminder and the runway are unchanged (they do not use `clipToDay`).

## Requirements

1. `clipToDay(w, D)` returns, for a night starting exactly at the end of D, an empty piece at 24:00 with
   `startsHere: true, endsHere: false`; for a night starting exactly at the start of D, `startsHere: false`.
2. The Clock and the day columns ask for windows up to D+2 so that night reaches them.
3. An empty piece draws only the moon and its edge line, never a band (`bedtime-band`).
4. Every moon carries `data-date` and `data-at` (`HH:MM`, `24:00` at the end of the day).

## Acceptance Criteria

1. Unit: with weekend 00:00–09:00, the night 2026-10-25 00:00–09:00 clips to 2026-10-24 as
   `{1440, 1440, startsHere: true, endsHere: false}` and to 2026-10-25 as `{0, 540, startsHere: false, endsHere: true}`.
2–4. e2e scenario "A bedtime at midnight shows its moon at the end of the evening before" (clock 24th: moons "24:00";
   clock 25th: "23:00"; week of 19th: 24th "24:00", 25th "23:00"); existing band scenarios stay green.

## Testing Plan

- Red unit test on `clipToDay` first, then code; `pnpm --silent verify`.
- Targeted e2e (mobile + desktop): the new scenario plus the existing bedtime band scenarios (day, week, clock,
  timeline/strip) and labs-clock. `@visual` and a look at the PNGs.

## Implementation Plan

1. Spec scenario + steps (weekend setup step, moons step) → check-steps 0 problems.
2. Unit test red → `clipToDay` change → green.
3. Range D..D+2 in `BedtimeDial` / `BedtimeColumn`, empty piece renders moon only, moon data attributes → e2e.
One PR-sized unit.

## Assumptions

- A1: The moon's aria label keeps the night's real bedtime ("00:00").
- A2: On the column the midnight moon sits just above the bottom edge (bottom 3px), mirroring the sun's placement.
