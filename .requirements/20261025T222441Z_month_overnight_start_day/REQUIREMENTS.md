# Month view: overnight events on their start day only

## As Is
A timed event under 24 h that crosses midnight (e.g. 22:00–02:00) shows as a chip on both days in the month view
(the month cell lists every per-day segment from `useDaySegments`).

## To Be
Owner decision 2026-10-25 (docs/HANDOFF-2026-10-25.md on origin/month-overnight, sections 1–7): the month view shows
such an event on its start day only, like Google Calendar. Week and day views keep one block per day. Events of 24 h
or longer and multi-day all-day events stay bars. Labs zoom month unchanged.

## Requirements
1. Month cell lists only the start-day segment of a timed overnight event under 24 h.
2. Week/day views, bars, Labs zoom month unchanged.
3. Hidden-entry counting (`seenCount`, `data-more`) counts only the entries the cell lists.

## Acceptance Criteria
1. Scenario "A timed event crossing midnight is shown on its start day only in the month view" passes (fails before).
2. Existing "A timed event crossing midnight is shown on both days" (@week) still passes; `pnpm verify` OK.
3. `more` is derived from the filtered list (code: `entries()` feeds `packWeek`, `seenCount` and `perDay[col].length`).

## Testing Plan
e2e scenario (@month) mobile + desktop, red then green; existing @month scenarios; @visual; `pnpm verify`.

## Implementation Plan
1. Scenario in spec/features/events/events-display.feature (+ intro text, edge case note) → run: red.
2. `entries()` in web/src/views/MonthView.vue filters `s.first` → run: green. CHANGELOG. One commit (PR-sized).

## Assumptions
- Known edge case: Sunday 22:00 → Monday 02:00 on the month's last day is not shown in the next month (Google does
  the same); noted in the feature text, owner not asked.
