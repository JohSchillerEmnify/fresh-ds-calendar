# Item components: fewer variants, one place per rule (night run 2026-10-23)

Source: docs/BACKLOG.md tech debt "Simplification & reuse audit of the overview item components" (owner, 2026-10-16),
plus the owner's overnight condition: behaviour- and look-preserving, every `@visual` picture identical, never
re-baseline. Coordination: the drag / pointer / hit-test code (dnd composables, time grid, EventItem block rendering,
EventBar's pointer handler) belongs to the parallel track `fix/overlap-pickup` until it is merged.

## As Is

- `TaskListCard.vue` (389 lines) renders a task list for every host: variants `card` (month cell), `allday` (week/day
  band), `block` (time grid), plus `chip` and `dot`, and the modes `grown`, `flat`, `mini`, `titles`/`collapsed`,
  `tight`, `up`. The fit ladder (how many item names show, inline or rows, the time foot) and the titleless "lead" rule
  are computed inline in the component, untested apart from `fitItems`.
- No host passes `chip` or `dot` to the task list renderer (MonthView/ZoomMonth/ZoomTimeline/HorizontalTime give
  `card`, TimeGrid/Strip/Timeline give `allday` or `block`); `dot` is passed to no renderer at all. Their branches and
  CSS are dead code kept alive by three unit tests that mount the card as `chip`.
- `EventItem` (dot/chip/allday/block), `EventBar` (multi-day bar, month chip look) and `BasicItem` (the registry's
  fallback renderer when a feature is not registered) repeat the chip look and the phone fade mask.
- `pnpm dedup`: 14 clones / 0.62 % (the backlog's 23 / 0.78 % baseline is out of date).

## To Be

- The task list card's layout rules (fit ladder, lead, item visibility) live in one pure, unit-tested function in
  `features/tasklists/layout.ts`; the component only renders its result.
- Dead variant branches and their CSS are gone; the variant set of each renderer is exactly what hosts use.
- Clone pairs outside the grid / drag code are shared helpers.
- Rendering, DOM contract (data-testid, data-* attributes) and pixels are unchanged.
- No behaviour change, so no spec change. The LikeC4 model changes only if the element structure changes.

## Requirements

1. R1 The fit/lead/visibility logic of `TaskListCard` is a pure function with unit tests that pin today's results for
   every variant and mode it handles.
2. R2 ~~`TaskListCard` drops the `chip` and `dot` branches and CSS that no host uses.~~ Moved to the proposal (it
   would delete golden states; owner decision). Replaced by: repeated rules shared by the item renderers move to one
   place each (`showsHandles`, `--fade-end`, `--block-sh`).
3. R3 Clones outside the drag/grid code are deduplicated (Settings/Theme save, labs day-range loading where it does not
   touch gesture binding).
4. R4 Steps that need the drag/pointer/hit-test code (EventItem, EventBar, TimeGrid, dnd, removing `dot` from
   `ItemVariant`, which forces an EventItem edit) are not done in phase 1; they are listed as phase 2 in the proposal.
5. R5 The larger consolidation ("one dynamic component driven by measured size") is written as a proposal in
   `docs/proposals/2026-10-23-item-components.md`, which is also the record of what was done.

## Acceptance Criteria

- AC1 (R1) New unit tests pass against the unchanged component logic first (characterization), then the component uses
  the extracted function and all web unit tests still pass.
- AC2 (R2) Each moved rule has one definition and a unit test where it is logic (`showsHandles`); goldens identical.
- AC3 (R1–R3) `pnpm --silent verify` prints `verify: OK`; `pnpm dedup` clone count does not rise.
- AC4 (all) The `@visual` scenarios have the same result as on the untouched branch, no snapshot file changed, and the
  actual pictures were looked at.
- AC5 (R4) Before `fix/overlap-pickup` was merged: no diff in `features/calendar/dnd*.ts`, `EventItem.vue`,
  `EventBar.vue`, `TimeGrid.vue`. After the merge (coordinator's go-ahead): EventItem / EventBar change only through the
  shared rules of R2; drag, pointer and hit-test handling (`dnd*.ts`, `motion/drag.ts`, `TimeGrid.vue`, EventBar's
  pointer handler) stay untouched.

## Testing Plan

- Baseline: `pnpm run build:e2e` + `E2E_SKIP_BUILD=1 e2e-locked --grep "@visual"` on the untouched branch.
- Per step: `pnpm -F @calendar/web test` (or the touched test files first), `pnpm --silent verify`, rebuild and the
  `@visual` run, then Read the actual PNGs.
- Characterization first: tests for the extracted function are written against the current inline logic's outputs.

## Implementation Plan

1. Proposal + this file (docs only).
2. `cardLayout()` in `layout.ts` + characterization tests; `TaskListCard` uses it. Test: unit, verify, @visual.
3. Remove `chip`/`dot` from `TaskListCard` (template, script, CSS), tests mount `card`. Test: unit, verify, @visual.
4. `useSettingsSave` shared by SettingsView/ThemeView. Test: unit, verify.
5. Labs `segsOf`/`loadRange` shared by HorizontalTimeView/ZoomMonthView (gesture binding untouched). Test: unit, verify.
   -> PR boundary: steps 1–5 are one reviewable PR (atomic commits).
6. Phase 2 (after `fix/overlap-pickup` is merged): see the proposal.

## Changes during the night

- Owner (via coordinator): component goldens first (Vitest browser mode, light + dark, 360 + 1280 px), baselines from
  the unchanged components, then refactor against them. Done before step 2; skin and resize-handle goldens were added
  and baselined before the steps that could move them.
- `fix/overlap-pickup` merged (main c2c138b); branch rebased, drag-adjacent steps (showsHandles, block shadow) then done.
- Step 3 (remove `chip`/`dot`) moved to the proposal: it would delete golden states, which the "goldens stay
  identical" rule does not allow without the owner.

## Assumptions (owner asleep)

- A1 "Look-preserving" is judged by the existing `@visual` pictures plus the unit tests; states without a picture are
  covered by reasoning that the removed code was unreachable / the moved logic returns identical values.
- A2 `BasicItem` stays: it is the extension registry's fallback, not a duplicate of a live renderer.
- A3 The three `chip` unit tests test the card's content, not the chip look; mounting them as `card` keeps their intent.
