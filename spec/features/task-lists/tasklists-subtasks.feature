@tasklists @items @id:tasklist-subtasks @area:tasklists
Feature: Subtasks in task lists
  An item can be nested under the item above it, up to three levels (task, subtask, sub-subtask). Nesting is done by
  dragging: further right makes an item a subtask, further left moves it up a level. On a computer, Tab and Shift+Tab do
  the same while an item is being edited. There is no extra button for it. Subtasks are always shown, indented one
  checkbox width per level, with faint lines that show the levels: straight guides by default, tree branches if chosen in
  the settings; while dragging, a dashed slot in the list shows exactly where the item will land.

  Background:
    Given the calendar is empty
    And tapping a task list grows it in place
    And today is 2026-10-12
    And the calendar contains a task list "Packing" on 2026-10-14 with items:
      | item  | done |
      | Tent  | no   |
      | Pegs  | no   |
      | Poles | no   |
      | Food  | no   |
    When I open the day view for 2026-10-14
    And I expand the task list "Packing"

  Rule: Dragging an item to the right makes it a subtask of the item above it

    Scenario: Dragging an item to the right nests it, and it stays that way
      When I drag the item "Pegs" one step to the right
      Then the item "Pegs" is a subtask of "Tent"
      When I reload the page
      And I expand the task list "Packing"
      Then the item "Pegs" is a subtask of "Tent"

    @mobile
    Scenario: On a phone an item is held and dragged to the right
      When I long-press the item "Pegs" and drag it one step to the right
      Then the item "Pegs" is a subtask of "Tent"

    Scenario: Dragging a subtask to the left moves it up a level
      Given the item "Pegs" was made a subtask of "Tent"
      When I drag the item "Pegs" one step to the left
      Then the item "Pegs" is not a subtask

    Scenario: Three levels are the most
      Given the item "Pegs" was made a subtask of "Tent"
      And the item "Poles" was made a subtask of "Pegs"
      When I drag the item "Food" three steps to the right
      Then the item "Food" is a subtask of "Pegs"

    Scenario: An item is at most one level deeper than the item above it
      When I drag the item "Poles" two steps to the right
      Then the item "Poles" is a subtask of "Pegs"
      And the item "Pegs" is not a subtask

    Scenario: The first item cannot become a subtask
      When I drag the item "Tent" one step to the right
      Then the item "Tent" is not a subtask

    Scenario: A task moves together with its subtasks
      Given the item "Pegs" was made a subtask of "Tent"
      When I drag the item "Tent" below the item "Food"
      Then the expanded task list items are "Poles, Food, Tent, Pegs"
      And the item "Pegs" is a subtask of "Tent"

    Scenario: A task moved up a level takes its subtasks along
      Given the item "Pegs" was made a subtask of "Tent"
      And the item "Poles" was made a subtask of "Pegs"
      When I drag the item "Pegs" one step to the left
      Then the item "Pegs" is not a subtask
      And the item "Poles" is a subtask of "Pegs"

  Rule: A held item is a compact card that follows the finger, and a dashed slot shows exactly where it lands

    The picked-up task becomes a compact card (checkbox and title, no grip, no bin) that follows the finger freely in
    every direction. In the list a dashed outline marks where it will land: it has the size of a row at the level the
    item will get, starts at that level's checkbox (the checkbox is drawn inside it, where the real one will sit) and
    ends before the bin; the grip is inside it. The tree line of the new parent runs down to the top of the
    slot, lit (primary colour, 2 px); at the first level none is. Moving sideways changes the level in steps of 28 px.
    The grips and bins of the rows never move.

    Scenario: The held item is a compact card with the checkbox and the title only
      When I hold the item "Pegs" one step to the right
      Then the held card shows the checkbox and the title "Pegs" but no grip and no bin

    Scenario: The card follows the finger in every direction
      When I hold the item "Pegs" and move the finger 50 px to the right and 30 px down
      Then the held card is under the finger
      When I move the finger 90 px to the left and 60 px up
      Then the held card is under the finger

    Scenario: A long title does not make the held card taller
      Given the browser window is 560 by 900 pixels wide and high
      And the item "Pegs" gets the title "Pegs for the big tent, the long ones with the hooks and the ones that bend easily when the ground is stony"
      When I hold the item "Pegs for the big tent, the long ones with the hooks and the ones that bend easily when the ground is stony" and move the finger 20 px to the right and 0 px down
      Then the held card is one line tall

    Scenario: The slot starts at the checkbox of the level the item will get
      When I hold the item "Pegs" one step to the right
      Then the slot is at level 1

    Scenario: Two levels in, the slot is two indents in
      Given the item "Pegs" was made a subtask of "Tent"
      When I hold the item "Poles" two steps to the right
      Then the slot is at level 2

    Scenario: A task keeps its level until the finger has moved half a step sideways
      When I hold the item "Pegs" and move the finger 13 px to the right and 0 px down
      Then the slot is at level 0
      When I move the finger 2 px to the right and 0 px down
      Then the slot is at level 1

    Scenario: The slot holds the checkbox, the title and the grip and stays clear of the bin
      When I hold the item "Pegs" one step to the right
      Then the slot has the size of a row, holds its checkbox and the grips, and no part of it is under a bin

    Scenario: The tree line of the new parent is lit and runs down to the slot
      Given the item "Pegs" was made a subtask of "Tent"
      When I hold the item "Poles" two steps to the right
      Then the lit tree line starts under the checkbox of "Pegs", is primary coloured and 2 px wide
      And the lit tree line runs down to the slot and stays clear of its checkbox

    Scenario: At the first level no tree line is lit
      When I hold the item "Pegs" and move the finger 0 px to the right and 0 px down
      Then no tree line is lit

    Scenario: The grips and bins of all rows stay where they are while an item is held
      When I hold the item "Pegs" one step to the right
      Then the grips and bins of the other items have not moved sideways

    Scenario Outline: The item lands exactly in the slot at level <level>
      Given the item "Pegs" was made a subtask of "Tent"
      And the item "Poles" was made a subtask of "Pegs"
      When I hold the item "<item>" <steps> to the <way>
      And I let go of the item
      Then the item "<item>" sits exactly where the slot was

      Examples:
        | item  | steps     | way   | level |
        | Poles | two steps | left  | 0     |
        | Food  | one step  | right | 1     |
        | Food  | two steps | right | 2     |

    Scenario: An item dragged up lands exactly in the slot
      When I hold the item "Food" and move the finger 28 px to the right and 130 px up
      And I let go of the item
      Then the item "Food" sits exactly where the slot was

    Scenario: An item dragged down lands exactly in the slot
      When I hold the item "Tent" and move the finger 0 px to the right and 112 px down
      And I let go of the item
      Then the item "Tent" sits exactly where the slot was

    Scenario: A task with a subtask lands exactly in the slot
      Given the browser window is 560 by 900 pixels wide and high
      And the item "Pegs" was made a subtask of "Tent"
      And the item "Poles" was made a subtask of "Pegs"
      When I hold the item "Pegs" and move the finger 0 px to the right and 60 px up
      And I let go of the item
      Then the item "Pegs" sits exactly where the slot was

    Scenario Outline: A task with a subtask lands exactly in the slot in a list that is scrolled
      Given the browser window is 560 by 300 pixels wide and high
      And the item "Pegs" was made a subtask of "Tent"
      And the item "Poles" was made a subtask of "Pegs"
      And the task list is scrolled to its end
      When I hold the item "Tent" and move the finger <x> px to the right and <y> px down
      Then the list has not moved since the item was picked up
      When I let go of the item
      Then the item "Tent" sits exactly where the slot was

      Examples:
        | x | y  |
        | 0 | 0  |
        | 0 | 56 |

    Scenario: The tree line follows a new parent that lies between the pick-up and the slot
      When I hold the item "Tent" and move the finger 28 px to the right and 112 px down
      Then the lit tree line starts under the checkbox of "Poles", is primary coloured and 2 px wide
      And the lit tree line runs down to the slot and stays clear of its checkbox

    @mobile
    Scenario: The slot is as tall as the row will be when its title wraps one line more one level deeper
      Given the item "Pegs" gets the title "Pegs and the spare mallet for the big camp"
      When I hold the item "Pegs and the spare mallet for the big camp" one step to the right
      And I let go of the item
      Then the item "Pegs and the spare mallet for the big camp" is taller than it was before it was held
      And the item "Pegs and the spare mallet for the big camp" sits exactly where the slot was

    @visual @mobile
    Scenario Outline: The held card and the slot look right at <level> in the <scheme> scheme
      Given the device prefers a <scheme> color scheme
      And the item "Pegs" was made a subtask of "Tent"
      When I hold the item "Poles" <steps> to the right
      Then the expanded task list "Packing" looks like the picture "subtasks-held-<level>-<scheme>"

      Examples:
        | scheme | steps     | level      |
        | light  | one step  | one-level  |
        | dark   | one step  | one-level  |
        | light  | two steps | two-levels |
        | dark   | two steps | two-levels |

    @visual @mobile
    Scenario: The slot of a task at the first level looks right
      When I hold the item "Poles" and move the finger 0 px to the right and 0 px down
      Then the expanded task list "Packing" looks like the picture "subtasks-held-level-0-light"

  Rule: When a list is created, spaces before a line make it a subtask

    A line becomes a subtask of the nearest line above it that is indented less, however many spaces it takes (one is
    enough); a line with no space before it is a task. Three levels are the most, as when dragging.

    Scenario: Indented lines become subtasks when a list is created
      When I open the week view for 2026-10-12
      And I start creating a task list
      And I fill in the task list form with:
        | title | Camping    |
        | date  | 2026-10-16 |
      And I type the items:
        """
        Tent
          Pegs
            Poles
        Food
        """
      And I save the task list
      And I expand the task list "Camping"
      Then the item "Pegs" is a subtask of "Tent"
      And the item "Poles" is a subtask of "Pegs"
      And the item "Food" is not a subtask

    Scenario: One space is enough, and a line cannot skip a level
      When I open the week view for 2026-10-12
      And I start creating a task list
      And I fill in the task list form with:
        | title | Camping    |
        | date  | 2026-10-16 |
      And I type the items:
        """
        Tent
              Pegs
         Poles
        """
      And I save the task list
      And I expand the task list "Camping"
      Then the item "Pegs" is a subtask of "Tent"
      And the item "Poles" is a subtask of "Tent"

  Rule: The lines of the edit form follow the same rule

    The edit form shows every item as a line, a subtask with spaces before it, judged by the rule of a new list. Changing
    the spaces changes the item's level; new lines get their level the same way.

    Scenario: Indented lines in the edit form change the levels and add subtasks
      When I edit the task list details
      Then the task list form shows:
        | items | Tent; Pegs; Poles; Food |
      When I type the items:
        """
        Tent
          Pegs
            Poles
        Food
        Rope
          Knots
        """
      And I save the task list
      And I expand the task list "Packing"
      Then the item "Pegs" is a subtask of "Tent"
      And the item "Poles" is a subtask of "Pegs"
      And the item "Food" is not a subtask
      And the item "Knots" is a subtask of "Rope"
      And the item "Rope" is not a subtask

    Scenario: A subtask shows with spaces before its line when editing
      Given the item "Pegs" was made a subtask of "Tent"
      When I edit the task list details
      Then the item line "Pegs" of the task list form is indented
      And the item line "Tent" of the task list form is not indented

    Scenario: Taking out a task keeps the subtasks that stay in their lines
      Given the item "Pegs" was made a subtask of "Tent"
      When I edit the task list details
      And I type the items:
        """
        Pegs
        Poles
        Food
        """
      And I save the task list
      And I expand the task list "Packing"
      Then the expanded task list items are "Pegs, Poles, Food"
      And the item "Pegs" is not a subtask

  Rule: On a computer, Tab and Shift+Tab nest the item being edited

    Scenario: Tab makes the item a subtask, Shift+Tab moves it back
      When I start renaming the item "Pegs" and press Tab
      Then the item "Pegs" is a subtask of "Tent"
      When I press Shift+Tab
      Then the item "Pegs" is not a subtask

  Rule: A task's tick and removal include its subtasks

    Scenario: Ticking a task ticks its subtasks, unticking unticks them
      Given the item "Pegs" was made a subtask of "Tent"
      And the item "Poles" was made a subtask of "Pegs"
      When I tick the item "Tent"
      Then the items "Tent, Pegs, Poles" are ticked
      And the task list "Packing" shows the done count "3/4"
      When I untick the item "Tent"
      Then the items "Tent, Pegs, Poles" are not ticked

    Scenario: Ticking the last open subtask does not tick its task
      Given the item "Pegs" was made a subtask of "Tent"
      When I tick the item "Pegs"
      Then the item "Tent" is not ticked

    @undo
    Scenario: Removing a task removes its subtasks, and undo brings them all back
      Given the item "Pegs" was made a subtask of "Tent"
      And the item "Poles" was made a subtask of "Pegs"
      When I delete the item "Tent"
      Then the expanded task list items are "Food"
      When I undo the deletion
      Then the expanded task list items are "Tent, Pegs, Poles, Food"
      And the item "Poles" is a subtask of "Pegs"

  Rule: A task is never done while one of its subtasks is open

    Whatever puts an open item under a done task opens that task again, and every task above it, so the open work
    stays visible. Ticking a task still ticks its subtasks, and ticking the last open subtask still leaves its task as
    it is.

    @backlog
    Scenario: Unticking a subtask of a done task opens the task
      Given the item "Pegs" was made a subtask of "Tent"
      When I tick the item "Food"
      And I tick the item "Tent"
      Then the items "Tent, Pegs, Food" are ticked
      When I untick the item "Pegs"
      Then the items "Tent, Pegs" are not ticked
      And the item "Food" is ticked
      And the task list "Packing" shows the done count "1/4"

    @backlog
    Scenario: Dragging an open item under a done task opens the task
      When I tick the item "Tent"
      And I drag the item "Pegs" one step to the right
      Then the item "Pegs" is a subtask of "Tent"
      And the item "Tent" is not ticked

    @backlog
    Scenario: Tab under a done task opens the task
      When I tick the item "Tent"
      And I start renaming the item "Pegs" and press Tab
      Then the item "Pegs" is a subtask of "Tent"
      And the item "Tent" is not ticked

    @backlog
    Scenario: An open sub-subtask opens both the subtask and the task above it
      Given the item "Pegs" was made a subtask of "Tent"
      And the item "Poles" was made a subtask of "Pegs"
      When I tick the item "Tent"
      Then the items "Tent, Pegs, Poles" are ticked
      When I untick the item "Poles"
      Then the items "Tent, Pegs, Poles" are not ticked

    @backlog
    Scenario: A new open line under a done task in the form opens the task
      When I tick the item "Food"
      And I edit the task list details
      And I type the items:
        """
        Tent
        Pegs
        Poles
        Food
          Stove
        """
      And I save the task list
      And I expand the task list "Packing"
      Then the item "Stove" is a subtask of "Food"
      And the item "Food" is not ticked

    @backlog
    Scenario: A list that already has a done task over an open subtask shows the task open
      Given Google contains a raw task list event "Camping" on 2026-10-14 with the description:
        """
        ☐ Order
        ☑ Assemble
        ☑ Tidy up
          ☐ Fold clothes
        """
      When I reload the page
      And I expand the task list "Camping"
      Then the item "Tidy up" is not ticked
      And the item "Fold clothes" is a subtask of "Tidy up"
      And the task list "Camping" shows the done count "1/4"

    @backlog
    Scenario: On the calendar card the open subtask stays under its open task
      Given the item "Pegs" was made a subtask of "Tent"
      When I tick the item "Tent"
      And I untick the item "Pegs"
      And I collapse the task list
      Then the collapsed task list "Packing" shows the item "Pegs" indented under "Tent"

  Rule: The subtask lines are straight guides or tree branches, as set under Task lists in the settings

    Straight guides (the default) are one thin vertical line per level, as in a code editor. Tree branches hang each
    subtask off its task with a short branch; the last one rounds off.

    @visual @mobile
    Scenario: Subtasks show straight guides by default and tree branches when chosen
      Given the item "Pegs" was made a subtask of "Tent"
      And the item "Poles" was made a subtask of "Pegs"
      Then the expanded task list "Packing" looks like the picture "subtasks-straight"
      When I set "Subtask lines" to "Tree" in the task list settings
      And I open the day view for 2026-10-14
      And I expand the task list "Packing"
      Then the expanded task list "Packing" looks like the picture "subtasks-tree"

  Rule: Subtasks show indented wherever items are shown, and Google keeps them

    Scenario: The Google event shows subtasks indented
      Given the item "Pegs" was made a subtask of "Tent"
      Then the Google event for the task list "Packing" has the description:
        """
        ☐ Tent
          ☐ Pegs
        ☐ Poles
        ☐ Food
        """

    Scenario: The collapsed list and the open tasks tray show subtasks indented
      Given the item "Pegs" was made a subtask of "Tent"
      When I collapse the task list
      Then the collapsed task list "Packing" shows the item "Pegs" indented under "Tent"
