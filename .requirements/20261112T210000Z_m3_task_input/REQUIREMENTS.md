# M3 task input (issue #48, slice "task input")

## As Is
Task list item rows in `TaskListView` are hand-built: a `RewardCheckbox` (32 px wrapper, only the box tappable), raw
`<input>`s for adding and editing (round 12 px field, outline on focus, row height changes), rows 48 px with 12 px
corners, delete 36×44 and grip 28×44 targets, the ink cell clickable by mouse only.

## To Be
Task input uses kit parts in `web/src/components/m3`, sized by the material-web token files v0.192:
- `Checkbox`: 18 px box, 2 px outline, 40 px round state layer, 48 px target; the reward (pop, drawn mark, sparkle,
  haptic) plays on a user's tick; the theme's checkbox shape and mark choices still apply.
- `ListItem`: leading / headline / supporting / trailing, one line at least 56 px (density-scaled, never under 48),
  16 px side padding and gaps.
- `TextField` inline mode: no floating label, filled container with 4 px top corners and a 1 px / 2 px (focused)
  active indicator.
Item rows, the title-tick row and the add row are `ListItem`s; delete and grip are 48 px targets; the ink cell is a
keyboard button when not writing. The footer keeps the "Add item" button (spec tasklists-collapse).

## Requirements and acceptance
Scenarios in `spec/features/task-lists/tasklists-items.feature`, Rule "Item rows look and feel like the rest of the app"
and `spec/features/app/visual.feature` "The list sheet's item rows, the add field and an item being edited ...".

## Testing plan
Unit: `web/test/m3-task-input.test.ts` (Checkbox, ListItem, TextField inline), existing `motion/components.test.ts`,
`tasklists.test.ts`, `tasklist-collapse.test.ts`. e2e (mobile): the items feature, the add-button, theme checkbox,
left-handed ink, canvas long-press and tray tick scenarios, plus the new and the template-footer `@visual` pictures.

## Assumptions
1. The theme's "Checkbox shape" choice stays (spec theme-menu); its default "Rounded" keeps a 5.5 px corner; "Square"
   is now exactly the M3 2 px. Changing the default to the M3 corner is left to the owner.
2. Rows in pen (ruled) mode keep their 52 px ruled line height.
3. The inline edit field starts at the headline, so the text moves 16 px right while editing (field padding per token).
4. `RewardCheckbox` (theme preview, motion lab) is now the kit `Checkbox` plus its striking label.
