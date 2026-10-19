# 2. Two-row week overview is a new component, reusing grid primitives

- Status: accepted
- Date: 2026-10-19

## Context

The week needs a mode that fits all seven days on one screen without scrolling, with entries
to scale over a shared active-hours window. The existing Time grid is a fixed 24-hour vertical
scroller with its own zoom.

## Decision

Build a separate **Two-row week overview** component. It reuses the shared layout primitives
(overlap packing, all-day packing, the item block renderer) but owns its fit-to-height,
active-window, two-row layout. The Time grid is left unchanged; the Week view picks the
overview or the grid based on prefs.

## Consequences

- The Time grid keeps its single 24-hour-scroll responsibility; no fit-to-height branching
  bloats it.
- The two grids share primitives, not layout — a packing fix benefits both.
- Shaped view: `web`.
