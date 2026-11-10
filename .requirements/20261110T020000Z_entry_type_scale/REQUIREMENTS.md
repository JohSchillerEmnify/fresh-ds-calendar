# Entry type scale (issue 76)

## As Is
Month, week and day share EventItem, TaskListCard and EventBar but size them differently: month overrides entry text to a fixed 12 px, blocks use fixed 13/11 px, task-list titles weigh 500, multi-day bars end in an ellipsis in week but fade in month on phones, the birthday marker differs between EventItem and EventBar, paddings differ per view.

## To Be
One set of `--entry-*` tokens (styles.css) for entry size, weight, marker and padding; sizes = px x `--dz`; phone one step smaller. Blocks keep a larger title (`--entry-title-lg`) only where wide enough; narrow blocks use `--entry-title`.

## Requirements
1. Same kind of entry, same size/weight in month, week, day. 2. All sizes follow density. 3. Phones one step smaller. 4. Multi-day bars fade on phones everywhere. 5. One marker size. 6. One padding per kind. 7. New `fonts` quality gate, ratcheted. 8. Golden `EntryScale` is the reference.

## Acceptance Criteria
Scenarios in spec/features/views/entry-scale.feature; `pnpm quality fonts` baseline 57 on main, lowered by this change; goldens re-recorded after review.

## Testing Plan
Targeted e2e of entry-scale + changed @visual; component goldens; verify.

## Implementation Plan
Gate, spec, tokens, component CSS, golden, rebaseline.

## Assumptions
Task-list title weight 600 (= event weight, owner decision). Line heights stay fixed (the block line budget in JS depends on them). Card paddings (tiers) are kept except the base one; BasicItem (Labs) not touched. Phone: title 10, block title 11, meta 10, micro 9.
