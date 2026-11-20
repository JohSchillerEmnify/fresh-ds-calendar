# One form for creating and editing a task list (issue 177)

## As Is
- `TaskListDialog.vue` has two modes. Creating shows items as a textarea, a repeat select, "From template", "Also save as template",
  handwriting lines and the Event / Task list switch. Editing shows "Add items" (typed lines are appended), no repeat,
  no template pill, no "Also save as template", no handwriting lines.
- Only the title of a repeating list asks "This task list / This and all following task lists".
- The server cannot change the repeat rhythm of an existing list (`PATCH` has no `recurrence`).

## To Be
One form, the same fields in the same order: Title, Date, Time, Estimate, Category, (Share with: issue 27, untouched here),
Reminders, Items, Repeat, "Also save as template". Only these differ by mode:
- the sheet title ("New task list" / "Edit task list");
- the Event / Task list switch (creating only);
- Delete / Leave (editing only);
- "From template" when editing first asks whether to replace the list's title, items, estimate and category.
Editing shows every item as a line (indentation = level). Saving renames, re-indents, deletes, adds and re-orders through the
existing outbox item ops (ticks stay on kept and renamed items). Handwriting lines are in both modes.
Repeat on edit is shown; a list that does not repeat can start repeating.

## Requirements and acceptance
1. Same fields and order in both modes (scenario "Creating and editing ... same fields in the same order").
2. Items are editable lines on edit: rename keeps the tick, delete removes, an inserted line lands in place, indentation
   sets the level, added lines are added (crud + subtasks features).
3. A repeating list asks for the scope when item lines change, as for the title (repeating feature).
4. "From template" and "Also save as template" in both modes; on edit "From template" asks first (templates feature).
5. Handwriting lines in the edit form (handwritten-lists feature).
6. Repeat on edit: shown with the current rhythm; a list that does not repeat can be set to repeat; changing the rhythm
   of a list that already repeats is NOT built (needs a series split with a new rule on the server): backlog scenario.

## Testing plan
Unit: the item diff (`itemEdits`), the server `recurrence` update. e2e (mobile, targeted): the changed and new scenarios
above, plus `@visual` pictures of the form at 375x812 light and dark.

## Implementation plan
1. Spec and steps. 2. Server: `recurrence` on `PATCH /tasklists/:id`. 3. `itemEdits.ts` + test. 4. Dialog.
5. i18n, CHANGELOG, pictures, verify.

## Assumptions
- Existing handwritten items are not shown as text lines in the edit form; they stay where they are.
- Under "this and all following" the item ops carry the scope; re-ordering has no scope and changes this list only.
- Lines are matched to existing items by title (longest common run); unmatched lines in the same gap are renames.
