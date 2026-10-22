# Right-hand side-by-side event cannot really be picked up

Owner bug report 2026-10-23 (phone, week and day view): of two overlapping events side by side (15:00 / 15:00 or
15:00 / 15:15, different lengths) the LEFT one picks up and moves easily, the RIGHT one "cannot really be picked up".
Reported once before and "supposedly fixed".

## As Is

- No earlier commit, spec scenario or backlog entry is about picking up a side-by-side block. The nearest earlier
  fixes (c4ddb84, fdb209e, 9468cc0) changed the overlap *layout* (cascade vs columns, drawn heights, title rows) and
  their tests check positions only; none picks a block up. So nothing guarded the pick-up of the right block.
- Evidence (throwaway Playwright probes, phone 375×812 touch, both views, 15:00–17:00 / 15:00–16:00,
  15:00–17:00 / 15:15–16:00, 15:00–15:45 / 15:15–17:00):
  - The right block is hit-tested correctly (elementFromPoint over its whole box: itself; no invisible hit area, no
    layer, no z-index problem) and a long press DOES lift it (`data-dragging="true"`, haptic).
  - But at the moment of pick-up the lifted right card jumps onto the left block's place: e.g. day view, finger at
    x 289, card before 204–374, held 26–204; week view, finger at 166, card before 155–177, held 128–151. The finger is
    no longer on the card. The left card stays under the finger (its offset is ~0).
  - Cause: `createSlotGrid` (web/src/motion/drag.ts) returns `dx = colLeft − originRect.left`, i.e. it magnets the
    card's LEFT edge to the left edge of the day column. Right-hand (and cascaded) cards sit right of that edge, so they
    are yanked sideways by half a column on pick-up, in the week and the day view, touch and mouse alike.
- Desktop: the same code path (the magnet ignores the pointer type); a mouse drag of the right card works but the card
  also jumps left onto the neighbour.
- Side finding, not the owner's main cause: in the phone week view a block's resize handles (44 px targets) are wider
  than a side-by-side block (~24 px) and cover up to ~28 % of the neighbour while shown (only after a release without
  moving). Owner decision 2026-10-23 (after review): handles are only as wide as their own block → R4.

## To Be

A picked-up timed card keeps its horizontal place inside its day column: it stays under the finger/pointer. Moved to
another day it keeps the same offset inside that column. Vertical snapping (15 min) and the drop result are unchanged.
A card that already fills its column (single entries, the left one) stays where it is; it no longer moves the 1 px
padding sideways (its dx is now 0 instead of −1).
Resize handles are never wider than their own block (the 44 px touch height stays), so they never cover a neighbour.

## Requirements

1. R1 — Picking up the right one of two side-by-side timed entries keeps it under the finger (phone, week and day view).
2. R2 — While dragged across days, a card's x offset inside its column is kept (dx = whole columns moved).
3. R3 — Everything else is unchanged: vertical snap, drop time, resizing by the handles, tap to open, the cascade
   look. Left/single cards keep their place (dx 0, the former −1 px nudge is gone).
4. R4 — (owner, 2026-10-23) A resize handle is at most as wide as its own block, keeping its 44 px touch height:
   touching a narrow side-by-side neighbour beside a block that shows its handles reaches the neighbour, not the
   handle.

## Acceptance Criteria

- AC1 (R1): new Scenario Outline in spec/features/events/dnd.feature, @mobile, week AND day view, 15:00/15:00 and
  15:00/15:15 with different lengths: after "I pick up the event Right" the event is lifted and the finger is on it;
  released, it is not lifted. Fails before the fix (finger not on the card), passes after. (Moving the right card
  already "worked" in emulation: the drag steps grab and drop by coordinates, so they never noticed the jump.)
- AC2 (R2): unit test on `createSlotGrid`: a card in the right half of column 1 gets dx 0 in column 1 and dx 2·colW in
  column 3; a card at a column's left edge gets dx 0 in its column and 1·colW one column further. The origin column is
  taken from the press point (`originRect.left + grab.x`).
- AC3 (R3): existing dnd/resize scenarios (phone + desktop targeted runs) and the @visual pictures stay green; pictures
  looked at.
- AC4 (R4): new @mobile scenario in the resize Rule: "Left" 15:00–15:45 and "Right" 15:15–17:00 side by side in the
  phone week view, "Left" shows its handles; a tap on "Right" right beside "Left"'s bottom handle opens "Right"'s
  dialog and hides "Left"'s handles. Fails before (the tap lands on "Left"'s 44 px handle), passes after.

## Testing Plan

- Red first: the Scenario Outline (phone) fails on "the finger is on the event"; the unit test fails on dx.
- Green: fix `createSlotGrid`, both pass.
- Regression: targeted `@dnd` scenarios on mobile and desktop by name, `pnpm --silent verify`, `@visual`.

## Implementation Plan

1. Spec: Scenario Outline + step "the finger is on the event {string}" (STEPS.md, dnd.steps.ts keeps the held
   point). Run → red for the right reason.
2. Unit test for `createSlotGrid` dx → red.
3. Fix `createSlotGrid`: dx = (column − origin column) · colW, origin column from `ctx.originRect.left`. → green.
4. Regression runs + pictures. (One PR-sized unit: steps 1–4.)

## Assumptions (owner asleep)

- A1: "picked up" means the card follows the finger from where it was held; a card jumping to the column's left edge
  is the defect, not intended magnet behaviour (the magnet's purpose is the 15-minute snap; full-width cards never
  showed the sideways part).
- A2: across days the card keeps its in-column offset (simplest consistent rule; it is re-laid out on drop anyway).
- A3: superseded by the owner's decision (R4). The width cap is applied everywhere, not only on phones: wherever a block is
  at least 44 px wide (all desktop cases seen) nothing changes, so the rule only acts where a handle would overhang.
- A4: if the owner's right-hand event was read-only (an invitation / someone else's calendar) it never drags by
  design; that cannot be checked from here.

## Implementation notes (2026-10-23, night run)

- Red: 6/6 new phone scenarios failed on "the finger is on the event" (e.g. day view: pressed at 289,569, card at
  26,564 178×45; week view: pressed at 166,441, card at 128,436 23×45). Unit test: dx −26 instead of 0.
- Fix: `createSlotGrid` dx = whole columns moved × column width (web/src/motion/drag.ts).
- Green: drag.test.ts 29/29; "Drag and drop to reschedule" 42/42 (mobile + desktop); "The cat helps me move an entry"
  and "Shortening an event below the minimum keeps the end it was given" green; @visual 12/12; `pnpm --silent verify` OK.
- "I pick up the event" now scrolls the chip into view first (15:00 is below the fold of the phone week view).

## Implementation notes, review round (2026-10-23)

- Scenario Outline trimmed to 5 steps (new step "I pick up the event X in the week/day view for D"); "the finger is on"
  also asserts the card is lifted. `createSlotGrid` takes the origin column from the press point. `heldAt` is cleared on
  release and set by "pick up … and move it down by N hours".
- R4: `.rh` is `left/right: max(0px, 50% − 22px)` (≤ 44 px, never wider than the block), the pill
  `min(28px, 100% − 4px)` wide (unchanged 28 px on blocks ≥ 44 px). Red first: the new scenario failed (the tap hit
  "Left"'s handle, its handles stayed, no dialog); green after.
- Looked at (phone): week view handles of a 24 px block stay inside it; day view handles unchanged; while dragging the
  right card it stays under the finger in the right half of the full-width drop indicator.
- Runs: drag.test.ts 29/29; dnd feature + support cat + min-length + @visual: 58/58 (mobile + desktop).
