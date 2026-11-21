# Dashed drop slot (#172)

As is: a held item shows a thin drop line.
To be: a dashed slot in the list shows exactly where the item lands; the new parent's tree line is lit.

Assumptions
- The slot is the row's box at the target level: top and height of the row, left edge 8 px left of the drawn checkbox box, right edge at the grip's right edge (bin outside).
- A ghost checkbox (outline only, outline colour) is drawn inside, at the real checkbox's place.
- The lit line is 2 px, primary colour, from under the parent's checkbox to the top of the slot; none at level 0.
- A held task with subtasks in a scrolled sheet: folding its subtasks shortens the sheet's scroll height, which can shift the rows (found, not changed here).
