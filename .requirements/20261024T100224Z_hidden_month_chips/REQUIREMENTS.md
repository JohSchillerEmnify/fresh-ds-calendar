# Month cells do not build entries hidden under the fade

Owner decision (2026-10-24): in the month view, chips that are completely hidden under a cell's fade are not built at
all. Accepted consequence: a screen reader no longer lists those events in the month grid (they stay in the week and
day views, and the day opens from the cell). Follow-up of `20261024T021957Z_month_view_perf` (hypothesis e: 63 % of a
busy month's entries are fully clipped but still rendered).

## As Is

- `MonthView.vue` builds every entry of every day (`rows` -> `days`); `.chips` clips with `overflow: hidden`, and
  `v-fade` (`lib/fade.ts`) sets `data-fade="true"` when `scrollHeight > clientHeight + 1`, which applies a bottom mask.
- There is **no "+N more"** in a month cell: the spec says so explicitly ("A crowded day in the month view fades out
  what does not fit ... shows no overflow count", events-display.feature).

## To Be

- An entry whose first slot starts at or below the entries box's bottom (`cellH - num - pad - cell gap - bottom
  border`, row maths from the grid height that `useElementSize` already observes, no layout read) is not built. The count of left-out entries is kept on the entries
  box as `data-more`.
- `v-fade` treats a box with `data-more` as overflowing (no layout read needed for it), so the mask stays even when
  the remaining entries happen to fit exactly. Pixels are unchanged.
- A new month view's first render uses the last grid height any month view measured (module-level; the swipe
  neighbour and the next month have the same size), so it does not build everything first and then drop most of it;
  its own measuring on mount corrects the value before the frame is painted. A grid never measured (jsdom, the very
  first view) builds everything, as before.

## Requirements

1. A month cell does not build entries that would lie completely below its entries box.
2. Every entry that would show at least one pixel is still built (pictures identical).
3. A cell that left entries out still fades at the bottom and still has no visible overflow count.
4. Deciding "completely hidden" costs no layout read per entry or per cell.

## Acceptance Criteria

1. e2e "Entries completely hidden under the fade of a month cell are not in the page": the 13th entry of a crowded
   desktop cell is not in the DOM; the cell's `data-more` > 0.
2. Same scenario: every built entry starts above the box's bottom; all @visual month pictures and the component
   goldens pass without re-baselining.
3. Same scenario: fade mask present, "shows no overflow count"; unit: `v-fade` sets `data-fade="true"` on a box with
   `data-more` whose content fits.
4. `seenCount` is pure maths (unit tests); `v-fade` reads no layout for a box with `data-more`.

## Testing Plan

- Unit (vitest, red first): `web/test/month-slots.test.ts` (`seenCount`), `web/test/month-measure.test.ts` (fade with
  `data-more`).
- e2e: the new scenario (desktop), the @month scenarios, @visual and goldens (no `--update-snapshots`).
- Perf: "A busy month renders and swipes smoothly", 6 runs before (base build) and 6 after (fix build), longest task
  and the sum of long tasks from the step annotations.

## Implementation Plan

1. `seenCount(slots, slotH, room)` in `lib/monthSlots.ts` + tests.
2. `v-fade`: `data-more` counts as overflow + test.
3. `MonthView`: `room = cellH - num - pad - (2 | 4)` (Infinity when unmeasured), slice each day's entries to
   `seenCount`, `:data-more` on the box; first render from the last measured grid height.
4. Spec scenario + two steps + STEPS.md (check-steps 0).
   PR boundary: all of the above is one small PR.

## Why row maths (and not the batched measurement)

- Alternatives: (a) measure in `fade.ts`'s batched flush which children lie below the box, then drop them; (b) row
  maths from the grid height. (a) can only decide after the entries were built and laid out, so it would build them,
  read their positions, and re-render without them: the build cost stays and a second render is added. (b) decides
  before anything is built, from numbers the view already has: every entry starts at `slot x slotH` inside the entries
  box (chips, all-day chips and bar gaps are exactly one slot per slot; task list cards are `span x slotH - gap`).
- The threshold is the exact box height: `num + pad + cell gap + bottom border` = 20+1+1+1 px on phones, 28+8+3+1 px
  wider (isPhone is `< 768px`, so the wider tier always has the `>= 768px` cell padding and gap). A first version used
  the upper bound `cellH - num` and kept one completely hidden entry in many cells (measured in the new scenario: box
  bottom 95.8 px, kept chip at 100 px), which is not what the owner asked; the exact height fixed it. A sub-pixel
  rounding difference could only leave out a sliver at the very bottom, where the mask is fully transparent.
- The remembered grid height: without it, a newly mounted month (swipe neighbour, next month) rendered with height 0,
  built all entries, then measured and unmounted about 60 % of them in the same task: the longest task got worse
  (fix without it, 9 runs: longest 242-1312 ms, median about 540) than the base.
- The mask: once entries are left out, the remaining content can end exactly at the box bottom (no scroll overflow), so
  `v-fade` would drop the mask and the picture would change; `data-more` keeps it on without a layout read.

## Assumptions (owner not reachable)

- **"The cell still shows '+N more'"**: there is no "+N more" in month cells today, and the spec demands none ("shows
  no overflow count"); adding a visible count would change every crowded month picture, which this task forbids. So
  the cell keeps its fade (no visible count) and only carries the count as `data-more`. Whether a visible or
  screen-reader-only "+N more" should be added is left to the owner.
- The month spec stays in `events-display.feature` next to the crowded-day scenario (the month cell's display rules
  live there; there is no separate month feature file).
- Architecture (LikeC4) and the system design are unchanged: no new component or flow, only a rule inside the month
  view's existing rendering.

## Results

Perf scenario "A busy month renders and swipes smoothly" (mobile, 4x CPU slowdown, laptop shared with other agents;
longest task / long tasks together, ms). Only runs at load average <= ~7 are counted; runs during load spikes (10-21)
reached 750-1800 / 3000-5700 for both builds and are not comparable.

- Base (4d36111), 12 runs: longest 264-471 (median about 390), together 1218-2176 (median about 1750).
- Final, 12 runs: longest 194-435 (median about 280), together 1182-1788 (median about 1500).
- Without the remembered grid height (9 runs): longest median about 540, worse than base (see above).

The gain (about -25 % longest task, -15 % together) is visible but smaller than the load noise on this machine (the
same build ranges from 270 to 830 ms longest between quiet and busy minutes), so the budgets (800 / 3500 ms) stay
unchanged.

Pictures: a throwaway scenario screenshotted the busy month (phone 2026-09/10/11, desktop 2026-10/11, desktop 900x640)
on the base and the final build: every month grid is pixel-identical; the only differing pixels are outside the grid
(nav rail ripple, top bar sync line, a check-in toast) and differ between two runs of the same build too.

Tests: unit (seenCount, fade with `data-more`) red then green; `pnpm --silent verify` OK; @month (mobile + desktop,
28) passed; @visual (12) passed; goldens (19) passed; nothing re-baselined.
