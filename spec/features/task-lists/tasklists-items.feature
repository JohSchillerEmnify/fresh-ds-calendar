@tasklists @items @id:tasklist-items
Feature: Working with task list items
  Items are ticked, unticked, added, renamed, removed and reordered (by dragging) inside an
  expanded task list. Every change is saved to Google immediately (optimistic UI).

  Background:
    Given the calendar is empty
    And the expanding task-list cards experiment is on
    And today is 2026-10-12
    And the calendar contains a task list "Groceries" on 2026-10-14 with items:
      | item  | done |
      | Milk  | yes  |
      | Eggs  | no   |
      | Bread | no   |
    When I open the day view for 2026-10-14
    And I expand the task list "Groceries"

  Scenario: Tick an item
    When I tick the item "Eggs"
    Then the item "Eggs" is ticked
    And the task list "Groceries" shows the done count "2/3"
    And the Google event for the task list "Groceries" has the description:
      """
      ☑ Milk
      ☑ Eggs
      ☐ Bread
      """

  Scenario: Untick an item
    When I untick the item "Milk"
    Then the item "Milk" is not ticked
    And the task list "Groceries" shows the done count "0/3"

  Scenario: Ticks persist after a reload
    When I tick the item "Bread"
    And I reload the page
    Then the task list "Groceries" shows the done count "2/3"
    When I expand the task list "Groceries"
    Then the item "Bread" is ticked

  Scenario: The collapsed view reflects changes made while expanded
    When I tick the item "Eggs"
    And I collapse the task list
    Then the task list "Groceries" shows the done count "2/3"

  Scenario: Add an item
    When I add the item "Butter"
    Then the expanded task list items are "Milk, Eggs, Bread, Butter"
    And the item "Butter" is not ticked
    And the task list "Groceries" shows the done count "1/4"
    When I reload the page
    Then the collapsed task list "Groceries" lists the items "Milk, Eggs, Bread, Butter"

  Scenario: Blank items are not added
    When I add the item "   "
    Then the expanded task list items are "Milk, Eggs, Bread"

  Scenario: Rename an item
    When I rename the item "Milk" to "Oat milk"
    Then the expanded task list items are "Oat milk, Eggs, Bread"
    And the item "Oat milk" is ticked
    And the Google event for the task list "Groceries" has the description:
      """
      ☑ Oat milk
      ☐ Eggs
      ☐ Bread
      """

  Scenario: Escape cancels renaming an item
    When I rename the item "Milk" to "Oat milk" but press Escape
    Then the expanded task list items are "Milk, Eggs, Bread"

  Scenario: Renaming an item to a blank title keeps the old title
    When I rename the item "Milk" to "   "
    Then the expanded task list items are "Milk, Eggs, Bread"

  Scenario: Remove an item
    When I delete the item "Eggs"
    Then the expanded task list items are "Milk, Bread"
    And the task list "Groceries" shows the done count "1/2"
    When I reload the page
    Then the collapsed task list "Groceries" lists the items "Milk, Bread"

  @undo
  Scenario: Undoing a removed item puts it back in its place
    When I delete the item "Eggs"
    And I undo the deletion
    Then the expanded task list items are "Milk, Eggs, Bread"

  Scenario: Removing the last item leaves an empty list
    When I delete the item "Milk"
    And I delete the item "Eggs"
    And I delete the item "Bread"
    Then the task list "Groceries" shows the done count "0/0"

  Rule: Items are reordered by dragging them (there are no up and down buttons)

    Dragging works wherever a list's items are shown and can be edited: the expanded list, the open tasks tray, the Tasks
    view and the Canvas note (there by the item's handle, because a press anywhere else on a note moves the note). The
    grown card over the calendar is read-only; a tap on it opens the expanded list. The move is optimistic like a tick and
    rolled back with a message if saving fails. Every item has a drag handle labelled "Drag <item> to reorder".

    Scenario: Dragging an item to another place reorders the list, and it stays that way
      When I drag the item "Bread" above the item "Milk"
      And I reload the page
      Then the collapsed task list "Groceries" lists the items "Bread, Milk, Eggs"

    @mobile
    Scenario: On a phone an item is picked up with a long press and moved
      When I long-press the item "Bread" and drag it above the item "Eggs"
      Then the expanded task list items are "Milk, Bread, Eggs"

    @mobile
    Scenario: A short tap on an item still ticks it and starts no drag
      When I tap the item "Eggs"
      Then the item "Eggs" is ticked
      And the expanded task list items are "Milk, Eggs, Bread"

    Scenario: An item dropped where it was changes nothing
      When I drag the item "Eggs" and drop it where it was
      Then the expanded task list items are "Milk, Eggs, Bread"

    @mobile
    Scenario: Picking up an item gives the same haptic tick as picking up an event
      When I pick up the item "Eggs"
      Then the item "Eggs" is lifted
      And a haptic tick was requested
      When I release the item without moving it
      Then the expanded task list items are "Milk, Eggs, Bread"

    Scenario: While an item is dragged, the other items make room
      When I drag the item "Bread" over the gap between "Milk" and "Eggs" and hold
      Then the items "Milk" and "Eggs" do not overlap the dragged item "Bread" and it lies between them

    Scenario: Every item has a labelled drag handle
      Then the item "Eggs" has the drag handle "Drag Eggs to reorder"

  Rule: A task list too big to store in Google is refused, and nothing is lost

    @backlog
    Scenario: Adding an item to a list that is already full is refused with a message
      Given the calendar contains a task list "Packing" on 2026-10-14 with 190 generated long items
      And I expand the task list "Packing"
      When I add the item "Sunscreen"
      Then I am told "Task list is too large"
      And the task list "Packing" does not contain the item "Sunscreen"
