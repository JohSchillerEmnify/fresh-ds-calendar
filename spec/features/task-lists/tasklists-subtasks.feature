@tasklists @items @id:tasklist-subtasks
Feature: Subtasks in task lists
  An item can be nested under the item above it, up to three levels (task, subtask, sub-subtask). Nesting is done by
  dragging: further right makes an item a subtask, further left moves it up a level. On a computer, Tab and Shift+Tab do
  the same while an item is being edited. There is no extra button for it. Subtasks are always shown, indented one
  checkbox width per level, with faint lines that show the levels: straight guides by default, tree branches if chosen in
  the settings; while dragging, the gap shows the level the item will get, with its line.

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
      Given the item "Pegs" is a subtask of "Tent"
      When I drag the item "Pegs" one step to the left
      Then the item "Pegs" is not a subtask

    Scenario: Three levels are the most
      Given the item "Pegs" is a subtask of "Tent"
      And the item "Poles" is a subtask of "Pegs"
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
      Given the item "Pegs" is a subtask of "Tent"
      When I drag the item "Tent" below the item "Food"
      Then the expanded task list items are "Poles, Food, Tent, Pegs"
      And the item "Pegs" is a subtask of "Tent"

    Scenario: A task moved up a level takes its subtasks along
      Given the item "Pegs" is a subtask of "Tent"
      And the item "Poles" is a subtask of "Pegs"
      When I drag the item "Pegs" one step to the left
      Then the item "Pegs" is not a subtask
      And the item "Poles" is a subtask of "Pegs"

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

  Rule: On a computer, Tab and Shift+Tab nest the item being edited

    Scenario: Tab makes the item a subtask, Shift+Tab moves it back
      When I start renaming the item "Pegs" and press Tab
      Then the item "Pegs" is a subtask of "Tent"
      When I press Shift+Tab
      Then the item "Pegs" is not a subtask

  Rule: A task's tick and removal include its subtasks

    Scenario: Ticking a task ticks its subtasks, unticking unticks them
      Given the item "Pegs" is a subtask of "Tent"
      And the item "Poles" is a subtask of "Pegs"
      When I tick the item "Tent"
      Then the items "Tent, Pegs, Poles" are ticked
      And the task list "Packing" shows the done count "3/4"
      When I untick the item "Tent"
      Then the items "Tent, Pegs, Poles" are not ticked

    Scenario: Ticking the last open subtask does not tick its task
      Given the item "Pegs" is a subtask of "Tent"
      When I tick the item "Pegs"
      Then the item "Tent" is not ticked

    @undo
    Scenario: Removing a task removes its subtasks, and undo brings them all back
      Given the item "Pegs" is a subtask of "Tent"
      And the item "Poles" is a subtask of "Pegs"
      When I delete the item "Tent"
      Then the expanded task list items are "Food"
      When I undo the deletion
      Then the expanded task list items are "Tent, Pegs, Poles, Food"
      And the item "Poles" is a subtask of "Pegs"

  Rule: The subtask lines are straight guides or tree branches, as set under Task lists in the settings

    Straight guides (the default) are one thin vertical line per level, as in a code editor. Tree branches hang each
    subtask off its task with a short branch; the last one rounds off.

    @visual
    Scenario: Subtasks show straight guides by default and tree branches when chosen
      Given the item "Pegs" is a subtask of "Tent"
      And the item "Poles" is a subtask of "Pegs"
      Then the expanded task list "Packing" looks like the picture "subtasks-straight"
      When I set "Subtask lines" to "Tree" in the task list settings
      And I open the day view for 2026-10-14
      And I expand the task list "Packing"
      Then the expanded task list "Packing" looks like the picture "subtasks-tree"

  Rule: Subtasks show indented wherever items are shown, and Google keeps them

    Scenario: The Google event shows subtasks indented
      Given the item "Pegs" is a subtask of "Tent"
      Then the Google event for the task list "Packing" has the description:
        """
        ☐ Tent
          ☐ Pegs
        ☐ Poles
        ☐ Food
        """

    Scenario: The collapsed list and the open tasks tray show subtasks indented
      Given the item "Pegs" is a subtask of "Tent"
      When I collapse the task list
      Then the collapsed task list "Packing" shows the item "Pegs" indented under "Tent"
