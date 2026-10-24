# Calm seasonal scenes: move for 10 s after opening, then a still picture

Owner decision 2026-10-24. Branch `feat/calm-seasons` (from main 4d36111).

## As Is

- The seasonal and holiday top bar scenes (`SeasonScene.vue` backdrop + `SceneLife.vue` living layer: Halloween,
  spring, summer, fall, winter, Easter, summer holidays, Christmas, New Year's Eve, New Year) run infinite CSS keyframe
  animations on SVG parts (stars, petals, moon clouds, lanterns, trees, cat) for as long as the app is open. Chrome
  cannot composite these, so every frame is painted on the main thread: with Halloween the idle main thread is busy
  2.4–2.9 s of every 3 s at 4x CPU slowdown (month-view perf investigation, 20261024T021957Z_month_view_perf).
- Visitors (butterfly/bat, Halloween ghost) are scheduled with `appTimeout` by `useSceneVisits` (first visit 20–60 s
  after the scene appears, then every 3–5 min; ghost every 8–12 min).
- Motion level Full/Reduced/Off (`motion/level.ts`, mirrored to `html[data-motion]`); `prefers-reduced-motion: reduce`
  caps it at Reduced (unless "allow full animations"). At Reduced the scenes still animate slowly; at Off everything
  is still (`styles.css` turns every animation off) — the "Off picture".
- The theme menu's preset cards and scene options draw small `SeasonScene` previews.

## To Be

- A seasonal scene moves for about 10 s after the app opens, then rests as a still picture.
- The still picture is the scene's resting frame: every animation removed (`animation: none`), i.e. exactly what the
  Off level already shows (the awake cat sitting, lanterns glowing steadily, stars at rest, the moon behind its clouds).
- With reduced motion (device, calm mode or the Reduced/Off setting: any effective level below Full) the scene is still
  from the start.
- Coming back to the app after it was hidden plays the 10 s again; while hidden the scene is still.
- Once still the scene costs nothing: no CSS animation, no visitor timers, no requestAnimationFrame loop (the scenes
  have none), the 10 s timer has ended.

## Assumptions (owner could not be asked)

1. **Returning counts as opening** (owner's stated assumption): `visibilitychange` to visible plays the 10 s again.
2. **Resting frame = the Off picture** (`animation: none`), not a paused last frame. Why: it is deterministic (a paused
   frame would freeze the cat mid-blink or mid-nap, a lantern mid-flicker, a petal half faded), it is the still look the
   app already ships and the owner has seen at Off, and it is what Playwright pictures show (`animations: 'disabled'`
   resets infinite animations to their start). Consequence: drifting snow/petals/bubbles/confetti start just outside the
   bar, so the still spring/fall/winter/Christmas/Easter/New Year backdrops show their gradient without particles — the
   same as Off today. Stars (Halloween, New Year's Eve) stay.
3. **Choosing a different scene also plays it for 10 s** (picking Halloween in the theme menu shows it alive, then it
   rests). Without this a scene picked a minute after opening would appear already still. Not asked for explicitly.
4. **Any effective level below Full is still** (device reduced motion, calm mode, the Reduced setting). The owner named
   the device setting; Reduced and calm mode exist for the same reason, so they get the same still picture. "Allow full
   animations despite the device setting" restores the 10 s of movement.
5. **Scope = the seasonal and holiday scenes** (`SeasonScene` everywhere, incl. the theme menu previews, and the
   `SceneLife` layer of those scenes). The sunflower field (default scene, its own swaying spec), Mordor and the own
   picture/drawn scenes are unchanged.
6. **Visitors**: no visitor comes while still. Their first visit is 20–60 s after the scene appears, so in practice the
   butterfly/bat and the ghost no longer come by on their own (only the test hook brings one at once). Reported as an
   owner point; not redesigned here.

## Requirements

1. R1 — For 10 s after the app opens, after it becomes visible again, and after the scene changes, a seasonal scene
   animates as before (Full level).
2. R2 — After those 10 s the scene is still: no running animation in the scene, no visitor, no scene timers.
3. R3 — At an effective motion level below Full the scene is still from the start.
4. R4 — While the app is hidden the scene is still; returning plays the 10 s again (R1).
5. R5 — The still picture is the Off picture; existing @visual pictures stay identical.
6. R6 — With the Halloween scene still, the idle main thread at 4x CPU slowdown is busy far less than before.

## Acceptance Criteria

- AC1 (R1): after opening the week view on 2026-10-31 (Halloween) the top bar scene has running animations.
- AC2 (R2): after 11 s (fake clock) the scene has no running animation and no `butterfly`/`bat`/`ghost` part.
- AC3 (R3): with `prefers-reduced-motion: reduce` the scene has no running animation right after opening.
- AC4 (R4): after it was still, "the app is hidden" + "the app regains focus" → animations run again; 11 s later still.
- AC5 (R5): `@visual` scenarios pass unchanged, no re-baselining.
- AC6 (R6): busy time (CDP `Performance.getMetrics` `TaskDuration` delta) over 3 s idle, 4x slowdown, Halloween still:
  well under the before value (before 2.4–2.9 s/3 s); guard budget in a @perf scenario.

## Testing Plan

- Unit (vitest): `sceneWake` — moving right after start at Full; still after 10 s; still at Reduced; hidden → still,
  visible → moving again then still after 10 s; scene change wakes; dispose clears the timer and listener.
- Unit: `useSceneVisits` — with `still` true no visit and no timer; a visit ends when the scene becomes still.
- e2e (theme-scenes.feature): the four owner scenarios with the fake clock (`the time is ... and the clock is
  running`, new step `{int} seconds pass`), plus a @perf busy-time scenario. Existing "own life" scenario still passes.
- @visual scenarios: run, look at the PNGs.
- Before/after numbers: the @perf scenario run on main code (red, numbers recorded) and on the change (green).

## Implementation Plan

1. Spec: scenarios + STEPS.md entries; check-steps 0.
2. e2e steps (`seconds pass`, `scene is moving/still`, `main thread busy`) → run perf scenario on unchanged app = before numbers.
3. `sceneWake.ts` + unit tests (red → green).
4. `useSceneVisits` `still` option + unit tests; wire in `SceneLife`/`HalloweenNight`.
5. Global CSS rule `html[data-scenes='still']` on `[data-season]` / seasonal `[data-life]`; install in `App.vue`.
6. e2e targeted runs, @visual, verify. One PR (single logical unit).

## Results (2026-10-24)

Measure: CPU time of the renderer + GPU processes (`SystemInfo.getProcessInfo`) over 3 s idle on the week view of
2026-10-31 (Halloween), phone viewport, starting ~12 s after opening. Not under CPU throttling: Chromium's
`setCPUThrottlingRate` itself burns renderer CPU (2.4 s per 3 s even with no scene), and the main-thread `TaskDuration`
alone misses the cost (the animations run on the compositor and GPU threads: 230 + 390 ms of 3 s in a trace).

| Where | Before | After | No scene |
|---|---|---|---|
| e2e container (headless, 1.5 CPUs), 3 runs | 1570–1740 ms | 30–110 ms | 10 ms |
| laptop (host Chromium, headless), 2–3 runs | 430–570 ms | 0–20 ms | 0 ms |

Running animations in the page after 12 s: 24 before, 0 after. Reduced motion: 4 running before, 0 after.

## Implementation notes

- `web/src/features/motivation/sceneRest.ts`: `sceneStill` (computed) + `useSceneRest(scene)` run once in `App.vue`;
  mirrors to `html[data-scenes]`. One `appTimeout` per wake, none once still.
- `styles.css`: `html[data-scenes='still']` removes every animation inside `[data-season]` and the seasonal
  `[data-life]` (not Mordor) — the Off picture.
- `useSceneVisits(…, still)`: no visit and no timer while still; `SceneLife` (not Mordor) and `HalloweenNight` pass it.
- The Reduced-level styling of the seasonal scene parts (slow clouds, breathing lanterns, ghost `fade`, bat rest at
  Reduced) is now unreachable for seasonal scenes; kept so that reverting assumption 4 is a one-line change.
- LikeC4 model unchanged: a module inside the existing "Top bar scene" component, no new component or relation.
- e2e: new steps `{int} seconds pass`, `the top bar scene is moving/still`, `the browser uses at most M ms of processor
  time in N seconds`. @visual pictures unchanged (none shows the top bar scene).
