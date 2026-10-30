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
  Christmas uses the same white flakes (`.christmas .p`) and has the same problem.

## To Be

- Fall: an autumn tree (37 x 46 px; orange, red, amber and gold crown, brown trunk; clearly unlike Halloween's black
  bare tree) and a leaf pile (30 x 10). Winter: a snowy bare tree (37 x 46), a snowman (24 x 30) with a red scarf, a
  snow drift 9 px tall. Props are part of the picture in both states (moving and still), light and dark, and stand
  still (no sway).
- When the 10 s end, the nine particles of Fall, Winter and Christmas glide in about 1 s to hand-placed spots inside
  the visible bar and rest there; by 11 s the scene is still. A resting particle may sit close to a control, never
  under one. The same picture shows from the start at Reduced and Off.
- Per header layout (header-layout.feature: nothing under a control, full size, the cat rule, props cut only at the
  bar's bottom edge): in Two rows (H2) and the as-built bar (H0) all props show at the mockup spots; in One row (H1)
  the trees and the snowman are left out (no gap wide enough, like the Easter hare); the leaf pile, the drift (full
  width) and the still particles stay, at their H1 spots. On desktop and tablets (wider one-row bar) every prop sits in
  a free gap by the same rules (full size, never under a control); those spots come from separate mockups.

## Requirements

1. R1 The Fall scene shows an autumn tree and a leaf pile; the Winter scene a snowy bare tree, a snowman with a red
   scarf and a snow drift; all at the sizes above, in light and dark, while moving and when still.
2. R2 No prop is under a control in any header layout or on desktop / tablet; props keep their full size (cut only at
   the bar's bottom edge) and do not sway.
3. R3 In One row the autumn tree, the snowy tree and the snowman are left out; the leaf pile and the drift stay.
4. R4 When the Fall, Winter or Christmas scene rests, its nine leaves / snowflakes lie at fixed, hand-placed spots
   fully inside the bar, per header layout (Fall / Winter: the `STILL` table of fwart.cjs; Christmas: still to be
   placed), the same picture every time; none under a control (close is fine).
5. R5 At Reduced and Off the scene shows the R4 picture from the start.
6. R6 When the moving window ends (10 s), the particles glide from where they are to their spots in about 1 s
   instead of jumping; by 11 s nothing moves.

## Acceptance Criteria

- AC1 (R1) "The Fall and Winter props stay when the scene rests": after 11 s the scene is still and shows the props
  and the cat. Look matches the approved mockup (snapshot below, plus a human look at phone size).
- AC2 (R2) "The Fall and Winter props sit clear of the controls": per layout and prop, the prop's drawn box does not
  intersect any control glyph. Full size on the phone is covered by header-layout's outline (Fall and Winter rows).
  "On desktop the Fall and Winter props sit in a free gap at full size": the same check plus full size, on desktop.
- AC3 (R3) "In one row the Fall scene leaves out its tree" and "... the Winter scene leaves out its tree and the
  snowman".
- AC4 (R4) "After the moving the leaves or snowflakes lie still where I can see them" (Fall, Winter, Christmas): 9
  particles fully inside the bar, not moving, snapshot `scene-<theme>-still`. "No resting leaf or snowflake is under
  a control": per layout, no particle box intersects a control glyph.
- AC5 (R5) "With fewer animations the scene shows the same still picture from the start": same 9-particle check and
  the same snapshot name as AC4, so the Reduced / Off picture equals the rested Full picture.
- AC6 (R6) "When the moving ends the leaves glide to their spots within a second": right after the window ends each
  particle has a running position transition and moves between two readings; 1 s later nothing runs and each is at
  its resting spot.

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
   SceneLife parts (`min(<n>cqh, <px>)`), no sway → AC1 e2e + `@visual` look.
2. Placement per layout (H0/H2 spots, H1 leaves out trees and snowman; desktop / tablet free gap once its mockups are
   approved) → AC2, AC3. Depends on the header-layout build (layout attribute on the bar); until it lands, only H0.
3. Still spots per scene and layout (Fall, Winter from fwart.cjs; Christmas spots hand-placed and shown to the owner
   first); applied under `html[data-scenes='still']` and at Reduced / Off → AC4, AC5 + unit.
4. Glide: a 1 s position transition when `data-scenes` turns `still` (Full only; Off already zeroes transitions) →
   AC6; re-run the still/perf scenarios.
5. Gates: `pnpm --silent verify`, targeted e2e, `@visual` look.

PR boundary: steps 1-5 are one PR (one visible feature, small). If the header-layout build is not merged yet, ship
steps 1, 3, 4 (H0 only) as PR 1 and step 2 as a sequential PR 2 after the header build (not stacked).

## Answered questions (owner, 2026-10-26)

- Q1 Glide length: about 1 s. It starts at 10 s and ends by 11 s, so the existing "still after 11 s" checks and the
  `@perf` idle window stay as they are.
- Q2 Desktop and tablets: the props sit in a free gap of the wider bar under the same rules (full size, never under a
  control). Mockups for those widths are made separately; the spec states only the rule.
- Q3 Christmas: same treatment; its flakes settle at hand-placed visible spots (added to the still-picture rule).
- Q4 A resting leaf or flake may sit close to a control, but never under one.

## Decisions (owner, 2026-10-26; were assumptions)

- D1 The props, like the characters, are never under a control.
- D2 The props do not move (no sway); only the particles move during the 10 s.
- D3 Part names for tests: `autumn-tree`, `leaf-pile`, `snowy-tree`, `snowman`, `snow-drift`.

## Round 3 (owner approved the mockups 2026-10-26; supersedes the sizes, R3 and "Still to place" above)

Source of truth: `fw-dark.png`, `fw-light.png` (phone H0 / H1 / H2), `fw-wide-dark.png`, `fw-wide-light.png` (desktop
1280 px, tablet 820 px), `fw-left.png` (left-handed), `xm-still.png` (Christmas flakes at rest); art, sizes and spots in
`~/.local/share/calendar-tools/mockups/fwart.cjs` and `fw.cjs` (round 3; `*-r1` are old).

- D4 Ground cover runs the full bar width and may pass behind controls: Fall a leaf-strewn ground (`leaf-litter`, 6 px),
  Winter a snow drift (`snow-drift`, 12 px) with a pale blue-grey fill in light mode.
- D5 Props as in fwart.cjs: autumn and snowy trees 43-64 px tall (per spot), snowman 34 x 42, leaf piles 39 x 13,
  sledge 34 x 13 (`sledge`). The Fall cat holds a kite (`kite`, 16 x 20 plus a tail) on a string to its paw; the kite
  sways 7 degrees while the scene moves.
- D6 Props spread over all the free areas; never under the title, the buttons or the Today pill.
- D7 No butterfly in Fall or Winter. Fall gets a flock of three birds (`bird-flock`), Winter a robin (`robin`, on the
  sledge), once per moving window like the other visitors.
- D8 After the 10 s the nine particles glide in 1 s to resting spots spread over the whole bar. Christmas flakes do the
  same (xm-still spots). Christmas candles and tree stay as built.
- D9 Left-handed (phone, touch tablet): the Fall and Winter scene layer is flipped (`scaleX(-1)`). The mirrored
  left-handed bar comes with header PR 1; its clearance check passes once PR 1 is in.
- D10 Desktop and tablet as on the wide sheets; the tablet cat moves out from under the Today pill.
- D11 One row (H1, header PR 1): the autumn tree and the snowman stand in the one-row gap (the cat moves to the bottom
  edge, head showing); the snowy tree is left out. This replaces R3: In One row the snowy tree is left out, the autumn
  tree, the snowman, the leaf pile, the sledge and the ground stay.

R3 (new) In One row only the snowy tree is left out (D11).
R7 The ground (leaf litter, snow drift) runs the full width of the bar (D4).
R8 The Fall cat holds a kite on a string; the kite sways only while the scene moves (D5).
R9 The Fall and Winter visitors are a bird flock and a robin; no butterfly (D7).
R10 In left-handed mode on a touch screen the Fall and Winter scene layer is drawn mirrored (D9).

AC7 (R7) "The Fall and Winter ground runs the full width of the bar". AC8 (R8) part `kite` in "props stay" and "sit clear
of the controls". AC9 (R9) "While the Fall or Winter scene moves its own visitor passes, not a butterfly". AC10 (R10)
"In left-handed mode the Fall and Winter scenes are drawn mirrored". R2 is checked on the default bar of each device
("The Fall and Winter props sit clear of the controls at full size", mobile + desktop); per header layout in PR B.

## Assumptions (owner away 2026-10-26; closest to the mockups)

- A1 Placement on other widths: the mockups are drawn at 390 (phone), 820 (tablet) and 1280 (desktop) px. A prop or
  resting particle keeps the mockup's distance to the nearer bar edge (left half: from the left, right half: from the
  right), because the controls are anchored that way (title and arrows left, widgets and buttons right). The table
  is chosen by the bar's width: phone below 768 px, tablet below 1100 px, desktop above.
- A2 A guard measures the controls' drawn boxes and hides any prop (not the ground) or resting particle that would
  still land under one (a narrow phone, a long title, today's left-handed bar before PR 1). Left out, never shrunk,
  as the Easter hare is.
- A3 The Fall and Winter cat moves to its mockup spot per layout (H0 Fall 240 px; tablet 512 px; others as built).
- A4 The flock flies across the bar during the visit (~10 s, like the butterfly); the robin hops onto the sledge,
  stays and leaves (~10 s). At Reduced the visitors come as still as the butterfly does (none, the scene rests).
- A5 The glide animates the particles from where they are when the window ends (position and opacity) to their spots
  with the Web Animations API (1 s, ease-out); Off and Reduced have no glide (still from the start).
- A6 Particles rest at the mockup's size (Fall 5/7/9 px leaves, Winter and Christmas flakes at 0.75), with a thin
  blue-grey rim on white flakes in light mode so they show on the pale bar.
- A7 Today's bar (H0) is built in PR A with the H0 spots; PR B adds the H1 / H2 spots once header PR 1 is on main.
  Header PR 1 was on main when PR A was done, so PR B replaces the H0 spots (that bar no longer exists on phones) and
  reads the header layout from the bar's `data-layout` (two rows when absent, e.g. the settings preview).
- A8 In one row and two rows the cat keeps the as-built 30 px height of the 96 px scene box (the mockups' size), so the
  one-row cat at the bottom edge shows its head; in one row the kite does not sway (it fills its gap) and its string
  runs to the bar's bottom edge.
- A9 Review 2026-10-26: a part that would reach above the bar is left out like one under a control; the kite is also
  judged by points along its string; the glide's horizontal offset is turned round in a mirrored (left-handed) scene.

## Build order (round 3)

- PR A (now, today's bar: phone H0, desktop, tablet): the art, the full-width ground, the props and the kite; the still
  picture and the 1 s glide; the visitors; the Christmas flakes at rest; the left-handed flip. Scenarios without a
  header-layout step lose `@backlog` as they pass.
- PR B (after header PR 1 is on main): the one-row / two-row spots per fw-dark.png and the scenarios with "the header
  layout is set to".

## Still to place (round 2; resolved by round 3)

- The Christmas still spots per layout and the desktop / tablet prop spots are not in the approved mockups; they are
  hand-placed and shown to the owner before the build of those parts.
