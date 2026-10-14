@tasklists @expand-card @id:tasklists-expand-card
Feature: A task list card expands in place over the calendar
  A task list card is only as tall as its time block, so a long list was cut off (owner, 2026-10-14). Tapping the card
  now expands it in place: it grows over the following slots or cells with elevation and a shadow, the calendar
  underneath does not move, and it stays inside the visible area (growing up, or scrolling inside, when there is no
  room below). Tapping the card again, tapping elsewhere, Escape, a change of view or date, or expanding another card
  collapses it; one card is expanded at a time and nothing is stored. Items can be checked only in the day view; in the
  week and month view the expanded card is read-only. Its edit button opens the task list dialog. A long press keeps
  its meaning (pick up, resize handles). On the phone's month view a tap on a card still opens the day (the cells are
  too small to hold a card).

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And the calendar contains a task list "Groceries" on 2026-10-14 at 09:00 for 30 minutes with items:
      | item   | done |
      | Milk   | yes  |
      | Eggs   | no   |
      | Bread  | no   |
      | Butter | no   |
      | Cheese | no   |
      | Apples | no   |
      | Rice   | no   |
      | Salt   | no   |

  Scenario: Tapping a task list in the day view expands it over the calendar and items can be checked there
    When I open the day view for 2026-10-14
    And I note where the task list cards are
    And I expand the task list "Groceries"
    Then the task list "Groceries" is expanded over the calendar
    And the expanded task list items are "Milk, Eggs, Bread, Butter, Cheese, Apples, Rice, Salt"
    And the expanded task list fits within the viewport
    And the task list cards have not moved
    When I tick the item "Eggs"
    Then the item "Eggs" is ticked
    And the task list "Groceries" shows the done count "2/8"

  Scenario: In the week view the expanded list is read-only
    When I open the week view for 2026-10-12
    And I expand the task list "Groceries"
    Then the task list "Groceries" is expanded over the calendar
    And the expanded task list items are "Milk, Eggs, Bread, Butter, Cheese, Apples, Rice, Salt"
    And the expanded task list shows the item "Milk" as done and the item "Eggs" as open
    And the expanded task list has no checkboxes

  @desktop
  Scenario: In the month view the expanded list is read-only
    When I open the month view for 2026-10
    And I expand the task list "Groceries"
    Then the task list "Groceries" is expanded over the calendar
    And the expanded task list shows the item "Milk" as done and the item "Eggs" as open
    And the expanded task list has no checkboxes
    And the expanded task list fits within the viewport

  Scenario: The edit button on the expanded card opens the list dialog
    When I open the week view for 2026-10-12
    And I expand the task list "Groceries"
    And I edit the task list details
    Then the task list form shows:
      | title | Groceries  |
      | date  | 2026-10-14 |
    And no task list is expanded

  Scenario: Long press on a task list still does what it did
    Given the task list "Groceries" shows resize handles in the day view for 2026-10-14
    Then no task list is expanded

  Scenario: Tapping elsewhere collapses it
    When I open the day view for 2026-10-14
    And I expand the task list "Groceries"
    And I tap outside the expanded task list
    Then the task list "Groceries" is collapsed

  Scenario: Tapping the card again collapses it
    When I open the day view for 2026-10-14
    And I expand the task list "Groceries"
    And I tap the task list "Groceries" again
    Then the task list "Groceries" is collapsed

  Scenario: Escape collapses it and gives the focus back to the card
    When I open the day view for 2026-10-14
    And I expand the task list "Groceries"
    Then the focus is inside the expanded task list
    And the card of the task list "Groceries" says it is expanded
    When I press Escape
    Then the task list "Groceries" is collapsed
    And the card of the task list "Groceries" has the focus
    And the card of the task list "Groceries" says it is collapsed

  Scenario: Changing the period collapses it
    When I open the day view for 2026-10-14
    And I expand the task list "Groceries"
    And I go to the next period
    Then no task list is expanded

  Scenario: Only one task list is expanded at a time
    Given the calendar contains a task list "Laundry" on 2026-10-14 at 15:00 for 30 minutes with items:
      | item   | done |
      | Wash   | no   |
      | Fold   | no   |
    When I open the day view for 2026-10-14
    And I expand the task list "Groceries"
    And I tap the task list "Laundry"
    Then the task list "Laundry" is expanded
    And the task list "Groceries" is collapsed

  @mobile
  Scenario: The add button never covers the expanded task list
    When I open the day view for 2026-10-14
    And I expand the task list "Groceries"
    Then the add button covers no control of the "expanded task list"
