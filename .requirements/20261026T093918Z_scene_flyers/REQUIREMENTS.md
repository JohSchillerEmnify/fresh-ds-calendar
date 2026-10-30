# Scene visitors fly through the picture again

Owner, 2026-10-26: "The flying elements are just in the top left corner on a phone with rounded corners, barely
visible. Previously they were flying through the frame, through the picture." It started well before the calm
seasonal scenes (2026-10-24).

## As Is

- In every production build the scene visitor (butterfly, bat at Halloween, the Halloween ghost) sits at the top-left
  corner of the top bar scene (its `left: 0; top: 0` origin); only its wing flap (`.bob`) animates.
- Root cause (evidence in the report): `.flutter { animation: 10s ease-in-out both; }` (SceneLife.vue) and
  `.ghost { animation: 8s ease-in-out both; }` (SceneGhost.vue) use the `animation` shorthand without a keyframe
  name; the name comes from a second rule (`.flutter.fly { animation-name: life-fly }`). The build's CSS minifier
  (lightningcss 1.33, Vite 8 default) rewrites a nameless shorthand to `animation:none`, dropping duration, timing and
  fill mode. The flight then has duration 0 s and never moves. Introduced 2026-10-13 by 4603b54 ("butterflies visit now
  and then"); the ghost (ef7f53d) had the same shape from its start. The dev server does not minify, so it looked
  right there.

## To Be

- The visitor crosses the whole scene during its visit (bat/butterfly left to right, ghost right to left), as the
  keyframes always described. Nothing else changes: the calm rule (10 s moving, one visitor, then still) stays.

## Requirements

1. R1 The visitor's flight keeps its duration, timing and fill mode in the production build.
2. R2 No scene style relies on a nameless `animation` shorthand (the minifier turns it into `animation: none`).

## Acceptance Criteria

- AC1 (R1) e2e, production build, phone and desktop, Halloween with the bat forced: sampled across its flight, the
  bat's horizontal centre covers from the left quarter to the right quarter of the top bar scene, and mid-flight it is
  fully inside the scene's box.
- AC2 (R2) unit: no `.vue`/`.css` under `web/src` has an `animation:` shorthand that has a duration but no keyframe name.

## Testing Plan

- New scenario "The visitor flies across the top bar scene" (theme-scenes.feature) with a new step that pauses the
  bat's flight animation and seeks it to 10 %..90 % (Web Animations API), reading the bounding box at each point.
  Red before the fix (no running flight animation / no horizontal movement), green after.
- touch-css-style unit guard (AC2): red before (two offenders), green after.
- Gates: `pnpm --silent verify`, `build:e2e`, targeted e2e on mobile + desktop: the theme-scenes scenarios and the
  `@visual` states; look at phone-size screenshots mid-flight.

## Implementation Plan

1. Spec + STEPS.md + step; unit guard → both red.
2. SceneLife.vue / SceneGhost.vue: write the longhands (`animation-duration`, `-timing-function`, `-fill-mode`) → green.
3. Gates. One PR-sized unit (bug fix).

Assumption: the owner's "previously" refers to the flight described by the keyframes (through the bar), which only
ever showed in builds before 4603b54 (butterflies wandered with a named animation) and in the dev server.
