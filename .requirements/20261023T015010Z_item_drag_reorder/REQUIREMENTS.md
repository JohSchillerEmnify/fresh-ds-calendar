# Reorder the items of a task list by drag and drop

## As Is
Items of a task list are reordered with up/down icon buttons (`tasklist-item-up/down`, `moveItem(dir)` in `ops.ts`), only in the
non-compact `TaskListView` (sheet, tray, Tasks view); the scenario "Reorder items" is `@reorder @optional`. `TaskListView` is the one
editable item renderer; the grown card over the calendar (`ExpandedCard`/`TaskListCard grown`) is read-only (a tap opens the sheet).
The server takes `PUT /api/tasklists/:id/items/order` with the full id permutation (spec/API.md).

## To Be
Items are dragged to a new place, everywhere `TaskListView` shows them (sheet, tray, Tasks view, Canvas note). The up/down buttons are
gone. The drag is the calendar's own controller (`motion/drag.ts`): haptic tick on pick-up, lift/wobble/drop, drag helper cat,
reduced-motion handling. The move is optimistic (ops queue) and rolled back with a snackbar on failure.

## Requirements
1. Dragging an item row to another row's place reorders the list; the order is saved (`PUT .../items/order`) and survives a reload.
2. Phone: an item is picked up by a long press (350 ms); a short tap still ticks, a touch that moves first scrolls.
3. Dropping where it was changes nothing and sends nothing.
4. Same reward mechanisms as the calendar (the same controller; scenario pins the haptic tick).
5. Up/down buttons, their scenario and steps are removed.
6. Works in the sheet, tray, Tasks view and Canvas note; on the Canvas the item is picked up by its handle only (a press elsewhere on
   a note moves the note, owner-pinned by the existing canvas scenarios).
7. Every item has a drag handle with an accessible label "Drag <item> to reorder".
8. A sheet's swipe-to-dismiss does not take the moves of an item drag.
9. Optimistic move, rollback on failure.

## Acceptance Criteria
1-4, 7: the agreed scenarios in `tasklists-items.feature` (incl. haptic + handle label). 6: Tasks view scenario in
`tasks-view.feature`; Canvas: existing "long-press on an item moves the note" scenarios stay green. 5: check-steps 0 problems/0 unused.
9: unit test (rollback + one PUT with the full order). 8: drag.ts unit tests stay green.

## Testing Plan
Unit: `web/test/tasklists-reorder.test.ts` (moveTo, dropIndex, slotOffset), `web/test/tasklists.test.ts` (optimistic move, PUT body,
rollback). e2e (desktop + mobile): the new scenarios; regressions: canvas item long-press, dnd + support-cat + haptic scenarios, @visual.

## Implementation Plan
1. `reorder.ts` pure logic + tests. 2. `ops.moveItemTo` replaces `moveItem`. 3. `useItemDrag` (one controller per row) wired in
`TaskListView`, grip handle, i18n `dragItem`. 4. Canvas pointer ignores the grip; drag controller stops touchmove propagation while
dragging. 5. Spec + steps + STEPS.md. 6. e2e + visual. (One PR-sized unit: the whole change.)

## Assumptions (owner asleep)
- "Expanded card in the calendar" = the expanded list sheet (`I expand the task list` ends in the sheet). The grown overlay card is
  read-only by its spec (data-readonly; tap opens the sheet) and is not draggable. Make it editable would be a spec change: owner decision.
- "I tap the item X" taps the item's checkbox (tapping the title edits it today).
- Items are picked up from the whole row (mouse: drag past 4 px; phone: long press); the handle is the visible affordance and the
  only pick-up on the Canvas.
- No live displacement of neighbouring rows: the lifted row snaps (magnet) onto the target place.
- Keyboard/screen-reader reorder is dropped by the owner's choice; list order stays readable in DOM order.
- LikeC4 model unchanged (no structural change); SYSTEM_DESIGN has no module doc in this repo area.
