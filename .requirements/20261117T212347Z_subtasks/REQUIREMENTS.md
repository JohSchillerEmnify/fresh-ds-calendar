# Subtasks in task lists (#165)

Contract: `spec/features/task-lists/tasklists-subtasks.feature`.

## As Is
A task list is a flat list of items (`TaskItem {id, title, done, ink?}`), stored as JSON in the private extended property
`items` of a Google event in the hidden tasks calendar (ADR 0006), mirrored as `☐/☑ title` lines in the description.

## To Be
Items nest up to three levels. A level is nothing more than a small field on each item; the order stays the array order,
so a subtask is every item that follows its task with a higher level.

## Requirements
1. `TaskItem.level` 1 or 2 (absent = task). Stored as `l` in the items JSON; old lists read as before. Google's description indents two spaces per level.
2. Rules live once in `shared/subtasks.js`: valid levels (first item is a task, at most one deeper than the item above, max 2), the block of a task, typed text with spaces to levels.
3. Dragging sideways (28 px per level) sets the level; the gap shows the level and its line; a task moves with its subtasks. Tab / Shift+Tab does the same while renaming.
4. Ticking a task ticks (unticks) its subtasks, ticking a subtask never changes its task; removing a task removes its subtasks, undo restores them.
5. Creating a list: leading spaces define levels (nearest less-indented line above is the parent).
6. Setting Settings, Task lists, Subtask lines: Straight (default) or Tree; pref `subtaskLines`.
7. Subtasks are indented in the collapsed card and the grown card too.

## Acceptance
Every scenario of the feature file is green on the mobile project; unit tests for the shared rules, codec, service, outbox and lines.

## Design decisions and assumptions
- One order call carries `levels` with the order (`PUT .../items/order {itemIds, levels?}`): a drag changes both at once and an offline device replays it as one change. Alternative (a new per-item level op) was rejected: two writes for one gesture, and a drag could be half applied.
- The server cascades tick and removal (the web mirrors it in the optimistic state with the same shared function), so every client (web, widget, API) gets the rule.
- A held task folds its subtasks away during the drag and they travel with it. Dropped below a task at its level or higher, an item lands after that task's subtasks; one level deeper it becomes the task's first subtask.
- A task with subtasks cannot go deeper than the levels it needs (three levels in all).
- Items typed under "Add items" when editing a list, and templates, stay flat (the spec names creation of a list only).
- Left-handed ink mode (checkbox on the right) keeps the indent on the left; its lines are not mirrored.
- No new storage kind: no ADR (the field rides in the existing items JSON).
