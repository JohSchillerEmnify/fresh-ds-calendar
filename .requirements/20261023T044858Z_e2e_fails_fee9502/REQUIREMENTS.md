# e2e failures of the full run on fee9502

Reconstructed after the merge: the original file was untracked in the worktree and was lost when the worktree was
removed. The content follows the agent's report.

## As Is
The full e2e run on main fee9502 (1637 tests) had 3 failures; all 3 also fail on 3859f72 (before the night run):
1. [mobile] performance "does not leak memory": `expandTaskList` waited for the grown card on the phone month path.
   Since 2fb5f5c (week-two-row merge a0005e9) growing in place is a Labs setting, off by default, so a tap opens the
   list sheet.
2. [desktop] door-board "Marking a list for the door from its sheet": the step tapped the card while the desktop tray
   was open; the tray then shows the list's row instead of a sheet (intended since cc3c2cf). Failing since eb89f04.
3. [mobile] first-load JS 156.6 KB > 150 KB: over since the zoom-month merge 08113dd (142.2 -> 153.6 KB); the night
   run lowered it from 165.2 KB.

## To Be
1 and 2 pass without weakening any check; 3 stays red until the owner picks a lazy-loading option.

## Requirements
- R1 `expandTaskList` accepts the sheet as the result of the first tap on every path (Acceptance: perf leak scenario
  passes incl. heap/DOM/listener checks).
- R2 The door sheet step waits for the data and opens the sheet through `expandTaskList` (Acceptance: passes on mobile
  and desktop, 3 runs each).
- R3 The 150 KB budget is not raised (Acceptance: unchanged in perf.steps.ts).

## Testing Plan
Targeted e2e of both scenarios on fee9502 (red) and with the fix (green); the 4 other month-view list scenarios;
check-steps; `pnpm --silent verify`.

## Implementation Plan
One test-only commit (31c240d) plus a doc fix (3260f67); no product code. Budget options for the owner: (a) load the
tray's list content when the tray opens (~9 KB), (b) split icons by style (~5 KB), (c) precompiled messages (~5 KB, new
dev dependency), (d) merge small startup chunks (header bytes).
