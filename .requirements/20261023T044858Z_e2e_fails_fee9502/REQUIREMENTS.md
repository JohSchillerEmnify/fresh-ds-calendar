# Three red scenarios of the full e2e run on main fee9502

## As Is
Full e2e on fee9502: 1634 passed, 3 failed. Bisected on a separate worktree (each scenario run alone):
1. [mobile] performance "Switching views ... does not leak memory", step "I expand and collapse the task list" — red since
   the week-two-row merge a0005e9 (2fb5f5c, 2026-10-19), green on its first parent 7c938a4. 2fb5f5c put growing in place
   behind the Labs pref `labsGrowCards` (off by default); off, a tap on a task-list card opens the list sheet at once.
   `expandTaskList` (e2e/steps/support/tasklist.ts) handles that ("first tap opens the sheet") except on the phone month
   path, where after the cell tap opens the day view it insists on the grown overlay.
2. [mobile] performance "The first load stays within the JavaScript budget": 156.6 KB vs 150 KB. Red since the zoom-month
   merge 08113dd (2026-10-14: 142.2 -> 153.6 KB). Not caused by tonight's merges (3859f72: 165.2 KB, fee9502: 156.6 KB).
3. [desktop] door-board "Marking a list for the door from its sheet" — red since the door merge eb89f04 (born red on
   desktop). The desktop tray is open and already shows the list, so a tap on the card reveals the tray row instead of
   opening a second copy as the sheet (feature since cc3c2cf, 2026-10-18; `ui.revealTask`). The step taps the card by hand
   instead of using `expandTaskList`, which collapses an open desktop tray first.

## To Be
1 and 3: the steps open the list sheet the way the product now behaves; no product change (the product does what its spec
says). 2: report only (needs lazy-loading/bundling work bigger than "small"; budget not raised).

## Requirements
R1. `expandTaskList` opens the sheet on the phone month path when the day-view tap opens the sheet directly (grow off),
    and still goes through the grown card when the Labs grow is on.
R2. "I open the list sheet of T and turn Show on door on" opens the sheet via `expandTaskList` (tray collapsed first on desktop).
R3. No test weakened, no budget raised, spec unchanged.

## Acceptance Criteria
AC1 (R1): the perf scenario gets past "I expand and collapse the task list" on mobile (its later heap/DOM checks are the
     known failures in e2e/KNOWN-FAILURES.md and are out of scope).
AC2 (R2): "Marking a list for the door from its sheet" passes on mobile and desktop.
AC3 (R3): the scenarios using `expandTaskList` that ran green stay green (tasklists-expand, a sample); `pnpm --silent verify` OK.

## Testing Plan
The failing scenarios are the reproducing tests (red on fee9502, evidence in the run logs). After the change: run the three
scenarios (mobile + desktop), plus the tasklists-expand feature scenarios that use the helper, then `pnpm --silent verify`.

## Implementation Plan
1. tasklist.ts: phone-month path accepts the sheet after the second tap -> run perf scenario (AC1).
2. door.steps.ts: use `expandTaskList`; STEPS.md wording -> run door scenario both projects (AC2).
3. verify + helper users (AC3). One PR-sized unit (test-only).
