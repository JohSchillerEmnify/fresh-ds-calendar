@tasklists @items @id:tasklist-subtasks
Feature: Subtasks in task lists
  An item can be nested under the item above it, up to three levels (task, subtask, sub-subtask). Nesting is done by
  dragging: further right makes an item a subtask, further left moves it up a level. On a computer, Tab and Shift+Tab do
  the same while an item is being edited. There is no extra button for it. Subtasks are always shown, indented one
  checkbox width per level, with faint lines that show the levels: straight guides by default, tree branches if chosen in
  the settings; while dragging, a drop line shows the level the item will get.

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

  Rule: A held item is a compact card that follows the finger, and a drop line shows where it lands

    The picked-up task becomes a compact card (checkbox and title, no grip, no bin) that follows the finger freely in
    every direction. A drop line in the list marks where it will land: it starts at the indent of the level the item
    will get and stops short of every checkbox. Moving sideways changes the level in steps of 28 px. The grips and bins
    of the rows never move.

    Scenario: The held item is a compact card with the checkbox and the title only
      When I hold the item "Pegs" one step to the right
      Then the held card shows the checkbox and the title "Pegs" but no grip and no bin

    Scenario: The card follows the finger in every direction
      When I hold the item "Pegs" and move the finger 50 px to the right and 30 px down
      Then the held card is under the finger
      When I move the finger 90 px to the left and 60 px up
      Then the held card is under the finger

    Scenario: The drop line starts at the indent of the level the item will get
      When I hold the item "Pegs" one step to the right
      Then the drop line is at the indent of level 1

    Scenario: Two levels in, the drop line starts two indents in
      Given the item "Pegs" was made a subtask of "Tent"
      When I hold the item "Poles" two steps to the right
      Then the drop line is at the indent of level 2

    Scenario: A task keeps its level until the finger has moved half a step sideways
      When I hold the item "Pegs" and move the finger 13 px to the right and 0 px down
      Then the drop line is at the indent of level 0
      When I move the finger 2 px to the right and 0 px down
      Then the drop line is at the indent of level 1

    Scenario: The drop line stays clear of every checkbox
      When I hold the item "Pegs" one step to the right
      Then the drop line touches no checkbox

    Scenario: The grips and bins of all rows stay where they are while an item is held
      When I hold the item "Pegs" one step to the right
      Then the grips and bins of the other items have not moved sideways

    @visual @mobile
    Scenario Outline: The held card and the drop line look right at <level> in the <scheme> scheme
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
