# Held item as a compact card (#172)

## As Is
A held item row lifts as a whole (grip and bin included) and, at a subtask level, only a dashed gap indents. A press right after a drop is ignored.

## To Be
The held row is a compact card (checkbox, title) that follows the finger freely; a drop line in the opened slot starts at the title column of the target level and touches no checkbox; the level changes in 28 px steps; grips and bins of all rows stay put. A press during the short wobble after a drop or cancel starts a new press at once.

## Requirements
1. Compact card without grip, bin or level lines, free-following (no magnet to the slot).
2. Drop line at the target level in every state, including level 0.
3. Pickup on the first long press, also right after a drop.

## Acceptance Criteria
Scenarios in `spec/features/task-lists/tasklists-subtasks.feature` (rule "A held item is a compact card ...") and `tasklists-items.feature` ("picked up again right after it was dropped"); unit test in `web/test/motion/drag.test.ts`.

## Assumptions
- "Stops short of the checkbox" is read as: the line starts at the title column of the level (after the checkbox), in the opened slot, so it never meets a checkbox.
- The finger sits 24 px inside the right end of the card at pick-up, so a move to the right has room on the screen.
- Pickup root cause: the controller ignored a pointerdown while in `dropping`/`returning` (about 200 ms wobble) and never retried; a press right after a drop was lost.
