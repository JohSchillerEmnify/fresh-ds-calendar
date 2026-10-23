# Owner decisions 2026-10-23

Three small decisions from the owner, one commit each.

## As Is

1. Left-handed mode on a tablet (`[data-touch]`, ≥ 768 px): the open tasks tray sits next to the navigation rail at the
   left, and the "+" (create button) sits at `left: rail + 24px` — on top of the open tray. The scenario "On an iPad in
   left-handed mode the add button sits on the left" pins the + to the left half of the screen.
2. `spec/features/task-lists/tasks-view.feature` still carries the agreed `@backlog` scenario "Tomorrow puts an undated
   list in the calendar on the next day", and its description mentions Today/Tomorrow actions. The owner removed those
   quick actions on 2026-10-13 (dragging into the calendar replaced them).
3. After an expired session the person returns to the page they were on once they sign in again (implemented,
   unit-tested in `web/test/stores.test.ts`), but no scenario pins it.

## To Be

1. Left-handed tablet: the + sits right of the open tasks tray (open: right of the 380 px panel; collapsed: right of
   the 56 px strip), never over it. Phone and desktop unchanged.
2. The Tomorrow scenario and its now-unused step are gone; the description no longer mentions Today/Tomorrow.
3. `signin.feature` has a scenario pinning the return to the previous page after signing in again.

## Requirements

- R1 In left-handed mode on a tablet the create button's left edge is at or right of the tray's right edge, open or
  collapsed.
- R2 The Tomorrow `@backlog` scenario and the Today/Tomorrow wording in the tasks-view feature description are removed;
  the step "I choose {string} for the task list {string} in the Tasks view" is removed from STEPS.md if unused.
- R3 A ≤ 5-step scenario next to "An expired session shows the sign-in page…" shows that signing in again returns to
  the page the person was on.

## Acceptance Criteria

- AC1 Reworded `@tablet` scenario passes (create button right of the tray, settings left, Today right); the other
  left-handed `@tablet`/`@desktop` scenarios still pass; tablet pictures with the tray open and collapsed show the +
  right of the tray at a sensible place.
- AC2 `python3 e2e/scripts/check-steps.py` reports 0 problems / 0 unused.
- AC3 The new sign-in scenario passes in the e2e run.

## Testing Plan

- Test first: reword the scenario + new step → run it red on the current CSS → fix CSS → green.
- Targeted e2e for the touched scenarios only; `pnpm --silent verify`.
- Throwaway screenshots (not committed) of the tablet with the tray open and collapsed.

## Implementation Plan

1. Commit 1 (left-handed tablet +): spec reword + step + CSS. Test: targeted e2e @tablet/@desktop left-handed.
2. Commit 2 (drop Tomorrow scenario): spec + STEPS.md. Test: check-steps.
3. Commit 3 (expired session return scenario): spec (+ step if missing). Test: targeted e2e.
PR boundary: all three together (one small branch).

## Assumptions

- A1 The reworded tablet scenario replaces the "+ on the left side" Then with "the create button sits right of the open
  tasks tray"; on a 820 px iPad the + then lands in the right half of the screen, which the owner accepted.
- A2 "Not over it" also applies to the collapsed tray strip (`--tray-w` follows the box width, 56 px collapsed).
