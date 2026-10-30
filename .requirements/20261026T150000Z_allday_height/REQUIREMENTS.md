# All-day entries 40 px tall in week/day views

## As Is
One row of all-day entries in week/day view: each chip is 40 px tall. The band's gutter holds the tasks-section switch
(44 px tap height) and spans every grid row, so its height feeds the row tracks; `.adcol` rows are a subgrid
(e985317), so chips stretch to the row (44 − 4 px padding). On phones chips also stretch to the 20 px bar row (18 px own).

## To Be
Chips keep their own height: 22 px desktop, 18 px phone, for any number of rows. The switch keeps a 44 px tap area,
covers no chip or day header, and stays where it is. The band keeps its earlier height (at least 44 px + border).

## Requirements
1. An all-day chip in the week/day band is at most 22 px tall (desktop) / 18 px (phone), one row or several.
2. The section switch is at least 44 px tall and overlaps no chip or day header.
3. Drag (adcol min-height 30) and the two-row overview (fit) look as before.

## Acceptance Criteria
1. Scenario "All-day entries stay thin, and the band's section switch stays easy to tap" (events-display.feature) passes
   on desktop, mobile and iphone; it was red on main (40 px).
2. Same scenario, switch step.
3. All @visual scenarios pass with unchanged baselines.

## Testing Plan
New scenario outline (week/day × one/two rows). Targeted e2e: events-display, dnd, two-row week, task lists display,
strip; @visual on mobile.

## Implementation Plan
1. Scenario + steps, prove red on main.
2. TimeGrid.vue: gutter `contain: size`; band `min-height: 45px; align-content: start`; `.adcol > * { align-self: start }`.

## Assumptions / decisions
- A thinner band (switch hanging into the head gutter) was tried first. It grows the two-row overview's hour height,
  which flips a grown task-list pill from tight to wrapping and clips its title (ExpandedCard `tight` < 30 px), turning
  an @visual scenario red. So the band keeps its 44 px height; only the rows stop stretching. A thinner band is a
  follow-up together with that pill fix (and the header work, which collapses the empty band).
