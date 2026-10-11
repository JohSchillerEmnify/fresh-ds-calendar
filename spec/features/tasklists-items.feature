@tasklists @items
Feature: Working with task list items
  Items are ticked, unticked, added, renamed, removed and (optionally) reordered inside an
  expanded task list. Every change is saved to Google immediately (optimistic UI).

  Background:
    Given the calendar is empty
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

  Scenario: Removing the last item leaves an empty list
    When I delete the item "Milk"
    And I delete the item "Eggs"
    And I delete the item "Bread"
    Then the task list "Groceries" shows the done count "0/0"

  @reorder @optional
  Scenario: Reorder items
    When I move the item "Bread" up
    Then the expanded task list items are "Milk, Bread, Eggs"
    When I move the item "Milk" down
    Then the expanded task list items are "Bread, Milk, Eggs"
    When I reload the page
    Then the collapsed task list "Groceries" lists the items "Bread, Milk, Eggs"
