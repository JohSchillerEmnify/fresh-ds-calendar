# 0034 — The month list has fixed week heights and its own windowing

- Status: accepted (owner decisions, 2026-10-31); builds on 0032
- Views shaped: `web`

## Decision
- "Month view scrolls: Up and down" stacks the months in one list. A week keeps one fixed height (96 px on a phone), so a
  month's height is plain arithmetic: only the month most in view and its two neighbours are built, with spacers of the
  exact size for the rest. `web/src/lib/monthList.ts` holds the arithmetic; each month is the existing `MonthView` as a block.
- "One month at a time" is native CSS scroll snapping (`scroll-snap-type: y mandatory`, `scroll-snap-stop: always`).
- The month most in view is the period: the URL follows it with `router.replace`. The scroll position of the list is kept in
  the history entry when the route is left, so going back is pixel-exact.

## Alternatives
- *A virtual-list library (e.g. vue-virtual-scroller)*: handles unknown row heights, which this list does not have; it would
  add a dependency, its own wrappers around the month grid, and no help with snapping or the pinned weekday row.
- *Stretched weeks (as the sideways month)*: no fixed height to compute from, so every month would have to be built and measured.
- *`router.push` per month*: a back step per month scrolled; the owner wants one back step out of the list.

## Consequences
- No structure change in the LikeC4 model: `MonthPage` chooses between `MonthView` and `MonthScroller` inside the web views.
- The list reaches January 1970 to December 2100; a deep link outside it is clamped.
