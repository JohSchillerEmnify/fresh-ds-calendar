# Fall and Winter scenes: props that stay and a still picture of their own

Owner decision, 2026-10-26: options (2) and (3), both. Approved mockups: `fw-dark.png` / `fw-light.png` (hdr-live
scratchpad); exact art, sizes, spots per header layout and still-particle spots in
`~/.local/share/calendar-tools/mockups/fwart.cjs` (with `fwlib.cjs`). Works together with the header-layout spec
(branch `spec/header`, `header-layout.feature`), which is being built now.

## As Is

- `web/src/features/motivation/SeasonScene.vue`: Fall and Winter are a tint (gradient) plus nine particles
  (`.p`, leaves / white flakes) placed at `top: -10px` and moved only by the `drift` animation.
- `sceneRest.ts`: the scene moves for `SCENE_AWAKE_MS` (10 s) at the Full animation level, then
  `html[data-scenes='still']`; `styles.css:118` sets `animation: none` on everything inside `[data-season]`. Below Full
  the scene is still from the start.
- So after the 10 s, and at Reduced / Off, every particle sits above the bar (`top: -10px`): the still Fall and Winter
  pictures are a bare tint plus the cat. There are no props (unlike Spring, Summer, Halloween and the holidays).

## To Be

- Fall: an autumn tree (37 x 46 px; orange, red, amber and gold crown, brown trunk; clearly unlike Halloween's black
  bare tree) and a leaf pile (30 x 10). Winter: a snowy bare tree (37 x 46), a snowman (24 x 30) with a red scarf, a
  snow drift 9 px tall. Props are part of the picture in both states (moving and still), light and dark.
- When the 10 s end, the nine particles glide to hand-placed spots inside the visible bar and rest there. The same
  picture shows from the start at Reduced and Off.
- Per header layout (header-layout.feature: nothing under a control, full size, the cat rule, props cut only at the
  bar's bottom edge): in Two rows (H2) and the as-built bar (H0) all props show at the mockup spots; in One row (H1)
  the trees and the snowman are left out (no gap wide enough, like the Easter hare); the leaf pile, the drift (full
  width) and the still particles stay, at their H1 spots.

## Requirements

1. R1 The Fall scene shows an autumn tree and a leaf pile; the Winter scene a snowy bare tree, a snowman with a red
   scarf and a snow drift; all at the sizes above, in light and dark, while moving and when still.
2. R2 No prop is under a control in any header layout; props keep their full size (cut only at the bar's bottom edge).
3. R3 In One row the autumn tree, the snowy tree and the snowman are left out; the leaf pile and the drift stay.
4. R4 When the scene rests, the nine leaves / snowflakes lie at fixed, hand-placed spots fully inside the bar, per
   header layout (the `STILL` table of fwart.cjs), the same picture every time.
5. R5 At Reduced and Off the scene shows the R4 picture from the start.
6. R6 When the moving window ends, the particles glide from where they are to their spots instead of jumping. The
   glide's length is an owner decision (open question Q1).

## Acceptance Criteria

- AC1 (R1) "The Fall and Winter props stay when the scene rests": after 11 s the scene is still and shows the props
  and the cat. Look matches the approved mockup (snapshot below, plus a human look at phone size).
- AC2 (R2) "The Fall and Winter props sit clear of the controls": per layout and prop, the prop's drawn box does not
  intersect any control glyph. Full size is covered by header-layout's outline (Fall and Winter rows).
- AC3 (R3) "In one row the Fall scene leaves out its tree" and "... the Winter scene leaves out its tree and the
  snowman".
- AC4 (R4) "After the moving the leaves or snowflakes lie still where I can see them": 9 particles fully inside the
  bar, not moving, snapshot `scene-<theme>-still`.
- AC5 (R5) "With fewer animations the scene shows the same still picture from the start": same 9-particle check and
  the same snapshot name as AC4, so the Reduced / Off picture equals the rested Full picture.
- AC6 (R6) "When the moving ends the leaves glide to their spots": right after the window ends each particle has a
  running position transition and moves between two readings; it ends at its resting spot. Duration not asserted
  until Q1 is answered.

## Testing Plan

- Scenarios (all `@backlog`) in `spec/features/themes/theme-scenes.feature`, two new rules at the end. New steps in
  `e2e/STEPS.md` (Scenes section); `check-steps` 0 problems. The header-layout steps used here ("the header layout is
  set to", "the top bar scene does not show the") are duplicated from `spec/header` so this branch stands alone.
- Build (later): red first per scenario, then green; targeted e2e only, mobile + desktop where untagged; snapshots
  created once on the owner's OK of the look; `@visual` pictures at phone size, light and dark, every layout, LOOKED at.
- Unit: the still-spot table has 9 spots per scene and layout, each inside the bar's height for that layout.
- Existing scenarios that must stay green: "The scene becomes a still picture after about ten seconds", "Coming back to
  the app plays the scene again", "A still scene leaves the processor free" (`@perf`: the glide must end before the
  measured 3 s idle), header-layout's scene outline.

## Implementation Plan

1. Prop components (AutumnTree, LeafPile, SnowyTree, Snowman, SnowDrift) from fwart.cjs, with `data-part`, sized like
   SceneLife parts (`min(<n>cqh, <px>)`) → AC1 e2e + `@visual` look.
2. Placement per layout (H0/H2 spots, H1 leaves out trees and snowman) → AC2, AC3. Depends on the header-layout build
   (layout attribute on the bar); until it lands, only H0.
3. Still spots per scene and layout; applied under `html[data-scenes='still']` and at Reduced / Off → AC4, AC5 + unit.
4. Glide: a position transition when `data-scenes` turns `still` (Full only; Off already zeroes transitions) → AC6,
   with the length from Q1; re-run the still/perf scenarios.
5. Gates: `pnpm --silent verify`, targeted e2e, `@visual` look.

PR boundary: steps 1-5 are one PR (one visible feature, small). If the header-layout build is not merged yet, ship
steps 1, 3, 4 (H0 only) as PR 1 and step 2 as a sequential PR 2 after the header build (not stacked).

## Open questions

- Q1 (owner) How long does the glide into the still spots take? The mockups show only start and end. Note: the existing
  "still after 11 s" scenarios and the `@perf` idle window assume nothing moves from about 11 s on, so a glide longer
  than about 1 s would need those scenarios adjusted.
- Q2 (owner) Desktop and tablets keep a one-row bar with the full date (header-layout); the mockups place props and
  particles only for a 390 px phone. Where do the props and the still particles sit on wider bars: the same px from
  the left, or kept clear of the controls by the same rule, spread across the width?
- Q3 (owner) Should Christmas (same white flakes, same `top: -10px` problem) get still spots too, or stay as it is?
- Q4 (owner, minor) May a resting leaf or flake sit close to a control glyph, as in the approved H1 mockup, or must the
  particles also keep clear of the controls like the props?

## Assumptions

- A1 The props are not "characters" in the header-layout sense, but the owner's "nothing under a control" applies to
  them too (the mockups place them clear), so AC2 checks it.
- A2 The props do not move (no sway); only the particles move during the 10 s.
- A3 Part names for tests: `autumn-tree`, `leaf-pile`, `snowy-tree`, `snowman`, `snow-drift` (the mockup used
  `snow-tree`).
