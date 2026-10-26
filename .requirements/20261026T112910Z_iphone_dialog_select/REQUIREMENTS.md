# iPhone: "Text in an event's dialog can still be selected" fails intermittently

## As Is
On the `iphone` (WebKit) project the scenario fails in roughly 2-5 of 8 runs with "text found in the dialog: 0".
The step probes `elementFromPoint` over the dialog's rect clipped to the viewport right after `toBeVisible()`.
Diagnostics in the step showed, on every failing run, the sheet's `up` entrance animation at `currentTime` 0,
`transform: translateY(597.6px)` (100 %), rect top = 664 = `innerHeight`: the grid had zero rows to sample.
The same flake rate is present on the fix/touch-drag tip (8c59253) that introduced the scenario, and at every later
merge (e198e48, 3f37b90, 5cfe6dd, dd95ea4, b386227): it is not a regression of the later merges.

## To Be
The step probes the dialog (or settings page) at rest, after its finite entrance animations finished, as a finger would.

## Requirements
1. "the text in the open dialog / on the page can be selected by a long press" waits until every finite animation in
   the probed area (subtree, `getAnimations`) has finished before sampling; infinite ones are ignored.
2. What the step checks is unchanged (16 px grid, own text, not a button, user-select not none, at least one found).

## Acceptance Criteria
1. The scenario passes 10/10 on `iphone` (was 5/8 failing on the same build).
2. `can still be selected|@id:event-location|@id:mobile-first-layout` pass on iphone, mobile and desktop.

## Testing Plan
The failing scenario is the test: red at --repeat-each=8 before, green at --repeat-each=10 after; then the gate grep.

## Implementation Plan
1. Wait for finite animations (`Animation.finished`) in `unselectableText`; STEPS.md describes it. (one PR)

Assumption: real users are not affected: once the sheet is up, the probe finds text everywhere and none is unselectable.
