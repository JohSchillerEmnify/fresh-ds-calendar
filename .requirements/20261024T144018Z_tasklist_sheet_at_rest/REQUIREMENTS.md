# Task list e2e: measure rows only once the sheet is at rest

## As Is
After merging feat/tasklist-all-weeks, "While an item is dragged, the other items make room" (mobile) failed. It also
failed on both merge parents (cf80dbd, ed6457d) about half the time, and so did "Picking up an item gives the same haptic
tick as picking up an event" (the wrong row was lifted). `expandTaskList` returned as soon as the sheet was visible, while
it was still sliding in by spring. A probe showed the row moving after the step returned (row y 635 -> 652, sheet y 484 -> 500).
The two steps measured row boxes right away and then touched stale coordinates. The other drag steps called
`scrollIntoViewIfNeeded` first, which waits for a stable box, so they passed.

## To Be
"I expand the task list" returns only once the sheet is at rest. App behaviour does not change.

## Requirements
1. `expandTaskList` waits until the sheet's bounding box is stable (Playwright's Stable check through `scrollIntoViewIfNeeded`).

## Acceptance Criteria
1. Both scenarios pass 5/5 with `--repeat-each=5` on mobile, and on desktop for the make-room scenario. Verify is OK, and the targeted set is green on mobile and desktop.

## Testing Plan
Reproduce first: the baseline with `--repeat-each=3` failed 3 of 6 runs on each parent. Then repeat the runs after the fix.

## Implementation Plan
1. Change one helper (e2e/steps/support/tasklist.ts). This is one PR-sized unit and changes tests only.
