# 2. Two-row week overview reuses the Time grid in a fit-to-height mode

- Status: accepted (supersedes the first draft of this ADR, which proposed a separate component)
- Date: 2026-10-19

## Context

The week needs a mode that fits all seven days on one screen without scrolling, with entries
to scale over a shared active-hours window. The existing Time grid is a fixed 24-hour vertical
scroller with its own zoom. A first build as a separate "overview" component duplicated the
grid's layout (columns, all-day band, hour lines) — and broke the inline grown task-list card,
which depends on the Time grid's DOM contract (`.grid > .col > .blk`) and hour height.

## Decision

No separate component. The Time grid gets an opt-in **fit mode** (`fit: {start, end}` window):
its effective hour height = measured area height / window hours, the window is pinned to the
top, nothing scrolls or zooms, and an empty slot tap opens the day. The Week view renders **two
Time grids in fit mode** (first `weekTwoRowTop` days, then the rest) over one shared window.
The effective hour height is provided to descendants (`provideHourHeight` /
`useEffectiveHourHeight`), so the expanded card lines up by construction. Default off: the
normal week is byte-for-byte unchanged.

## Consequences

- Zero duplicated layout; the all-day band, hour lines, blocks and the inline grown card are
  the Time grid's own.
- The grown card's inline expansion works in the overview for free (same DOM contract).
- Shaped views: `web`, `turnOnOverview`.
