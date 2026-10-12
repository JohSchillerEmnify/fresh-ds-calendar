@tasklists @crud
Feature: Creating, editing and deleting task lists
  Task lists are created from the floating "+" button ("Task list"), with a title, a date,
  an optional time and optional initial items (one per line).
  In Google each task list is one event with extendedProperties.private.kind = "tasklist".

  Background:
    Given the calendar is empty
    And today is 2026-10-12

  Scenario: Create a task list on a date
    When I open the week view for 2026-10-12
    And I start creating a task list
    And I fill in the task list form with:
      | title | Groceries         |
      | date  | 2026-10-14        |
      | items | Milk; Eggs; Bread |
    And I save the task list
    Then the task list dialog is closed
    And I see the task list "Groceries" on 2026-10-14
    And the collapsed task list "Groceries" lists the items "Milk, Eggs, Bread"
    And the task list "Groceries" shows the done count "0/3"
    And the Google event for the task list "Groceries" is an all-day event on 2026-10-14
    And the Google event for the task list "Groceries" has the private extended property "kind" set to "tasklist"
    And the Google event for the task list "Groceries" has the description:
      """
      ☐ Milk
      ☐ Eggs
      ☐ Bread
      """

  Scenario: Create a task list with a time
    When I open the week view for 2026-10-12
    And I start creating a task list
    And I fill in the task list form with:
      | title | Packing    |
      | date  | 2026-10-15 |
      | time  | 18:00      |
      | items | Passport   |
    And I save the task list
    Then the task list "Packing" is positioned at 18:00
    And the Google event for the task list "Packing" is a timed event on 2026-10-15 from 18:00 to 18:30

  Scenario: Create an empty task list
    When I open the day view for 2026-10-14
    And I start creating a task list
    And I fill in the task list form with:
      | title | Ideas      |
      | date  | 2026-10-14 |
    And I save the task list
    Then the task list "Ideas" shows the done count "0/0"

  Scenario: The new task list form defaults to the focused day without a time
    When I open the day view for 2026-10-20
    And I start creating a task list
    Then the task list form shows:
      | title |            |
      | date  | 2026-10-20 |
      | time  |            |

  Scenario: A created task list is still there after a reload
    When I open the day view for 2026-10-14
    And I start creating a task list
    And I fill in the task list form with:
      | title | Groceries  |
      | date  | 2026-10-14 |
      | items | Milk; Eggs |
    And I save the task list
    And I reload the page
    Then the collapsed task list "Groceries" lists the items "Milk, Eggs"

  @validation
  Scenario Outline: A task list needs a non-blank title
    When I open the day view for 2026-10-14
    And I start creating a task list
    And I fill in the task list form with:
      | title | <title>    |
      | date  | 2026-10-14 |
    And I save the task list
    Then the task list dialog shows the error "Title is required"
    And the task list dialog is open

    Examples:
      | title |
      |       |
      | "   " |

  @cancel
  Scenario: Cancelling the new task list dialog creates nothing
    When I open the day view for 2026-10-14
    And I start creating a task list
    And I fill in the task list form with:
      | title | Never mind |
      | date  | 2026-10-14 |
    And I cancel the task list dialog
    Then the task list dialog is closed
    And I do not see the task list "Never mind"
    And Google contains no event "Never mind"

  Scenario: Rename a task list
    Given the calendar contains a task list "Groceries" on 2026-10-14 with items:
      | item | done |
      | Milk | no   |
    When I open the day view for 2026-10-14
    And I expand the task list "Groceries"
    And I rename the task list to "Weekly shop"
    Then the task list "Weekly shop" is expanded
    And Google contains no event "Groceries"
    When I reload the page
    Then I see the task list "Weekly shop" on 2026-10-14

  Scenario: Move a task list to another date and give it a time
    Given the calendar contains a task list "Groceries" on 2026-10-14 with items:
      | item | done |
      | Milk | no   |
    When I open the week view for 2026-10-12
    And I expand the task list "Groceries"
    And I edit the task list details
    Then the task list form shows:
      | title | Groceries  |
      | date  | 2026-10-14 |
      | time  |            |
    When I fill in the task list form with:
      | date | 2026-10-16 |
      | time | 17:00      |
    And I save the task list
    Then I see the task list "Groceries" on 2026-10-16
    And the task list "Groceries" is positioned at 17:00
    And the Google event for the task list "Groceries" is a timed event on 2026-10-16 from 17:00 to 17:30

  Scenario: Remove the time from a task list
    Given the calendar contains a task list "Packing" on 2026-10-15 at 18:00 with items:
      | item     | done |
      | Passport | no   |
    When I open the week view for 2026-10-12
    And I expand the task list "Packing"
    And I edit the task list details
    And I fill in the task list form with:
      | time |  |
    And I save the task list
    Then the task list "Packing" is shown in the all-day area on 2026-10-15
    And the Google event for the task list "Packing" is an all-day event on 2026-10-15

  @cancel
  Scenario: Cancelling the task list details dialog keeps the task list unchanged
    Given the calendar contains a task list "Groceries" on 2026-10-14 with items:
      | item | done |
      | Milk | no   |
    When I open the week view for 2026-10-12
    And I expand the task list "Groceries"
    And I edit the task list details
    And I fill in the task list form with:
      | title | Changed    |
      | date  | 2026-10-16 |
    And I cancel the task list dialog
    Then I see the task list "Groceries" on 2026-10-14
    And I do not see the task list "Changed"

  Scenario: Delete a task list
    Given the calendar contains a task list "Groceries" on 2026-10-14 with items:
      | item | done |
      | Milk | no   |
    When I open the day view for 2026-10-14
    And I expand the task list "Groceries"
    And I delete the task list
    And I confirm the deletion
    Then I do not see the task list "Groceries"
    And Google contains no event "Groceries"
    When I reload the page
    Then I do not see the task list "Groceries"

  Scenario: Deleting a task list from its expanded view closes it and it stays gone
    Given automatic sync runs every 2 seconds
    And the calendar contains a task list "Groceries" on 2026-10-14 with items:
      | item | done |
      | Milk | no   |
    When I open the day view for 2026-10-14
    And I expand the task list "Groceries"
    And I delete the task list
    And I confirm the deletion
    Then no task list is expanded
    And I do not see the task list "Groceries"
    When I wait for the automatic sync
    Then I do not see the task list "Groceries"
    And the open tasks tray does not list "Groceries"

  @cancel
  Scenario: Cancelling the delete confirmation keeps the task list
    Given the calendar contains a task list "Groceries" on 2026-10-14 with items:
      | item | done |
      | Milk | no   |
    When I open the day view for 2026-10-14
    And I expand the task list "Groceries"
    And I delete the task list
    And I cancel the deletion
    Then the task list "Groceries" is expanded

  Scenario: A task list with many items is stored in chunks and survives a reload
    Given the calendar contains a task list "Big" on 2026-10-14 with 40 generated items
    When I open the day view for 2026-10-14
    Then the task list "Big" shows the done count "0/40"
    And the Google event for the task list "Big" stores its items in more than one chunk
    When I reload the page
    And I expand the task list "Big"
    And I tick the item "Generated item 40"
    Then the task list "Big" shows the done count "1/40"
