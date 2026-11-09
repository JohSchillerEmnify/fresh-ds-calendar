# Add items while editing; tick a title-only list

## As Is
- The edit dialog (TaskListDialog, mode edit) has no items field; items are added only with "+" in the expanded list.
- A list with a title and no items shows "No items yet" and nothing to tick.

## To Be
1. The edit dialog has "Add items (one per line)"; saved lines are appended (outbox item.add, offline-safe, repeat-scope asked).
2. A list with a title and zero items shows a tick box with the title in the list view; ticking adds the title as the first item, already done.

## Requirements and acceptance
- R1: scenarios "Items can be added to a task list while editing its details" / "...only a title" (tasklists-crud.feature). Cap of 200 items counts existing + typed.
- R2: scenarios in tasklists-items.feature (title-only list).

## Assumptions
- A1: "editing" = the details dialog opened by the edit action. Items are only appended, existing ones are edited in the list.
- A2: Title-only tick: the list keeps its title; one item with the same title is created and done (list = 1/1 complete). Applies only at 0 items; titleless lists get no tick row.
- A3: Edit-dialog items ask the repeat-scope question. The title tick does not: ticks stay per list, the item is added for this list only (the server ignores done on a following-scope add).
