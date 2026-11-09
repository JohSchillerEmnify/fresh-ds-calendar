# Side by side: "Only 1"

## As Is
Day (Up to 2/3/4) and week (Up to 2/3) side-by-side settings always use `packSideBySide`; the earlier start-group cascade is only used by Labs (limit 0).

## To Be
A lowest option "Only 1" for both views = the earlier behaviour: starts within 15 min / one title row share columns, later overlaps are stacked on top. Defaults unchanged (day 4, week 2).

## Requirements and acceptance
1. Pref values 1 accepted (day 1-4, week 1-3), others 400. Server test.
2. limit 1 lays out exactly as limit 0 (web `packColumns`, Android `WeekLayout.packColumns`). Unit tests.
3. Settings show "Only 1" (all locales) and choosing it changes the view. Scenarios in events-display.feature.

## Assumptions
- Reuse the limit-0 path by treating limit <= 1 as "no side-by-side packing"; no new algorithm.
- German variants: "Nur 1" in all three.
