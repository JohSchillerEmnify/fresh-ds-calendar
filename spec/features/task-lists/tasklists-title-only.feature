@tasklists @items @id:tasklist-title-only
Feature: A task list with only a title can be ticked
  A task list that has a title but no items is a single task: its list view offers a tick box beside the title.
  Ticking it moves the title into the list's first (and only) item, already ticked, and the list has no title any more, so it is done like any list
  whose items are all ticked. This holds only while the list has no items; a list with one or more items behaves as
  usual, and a list without a title offers nothing to tick.

  Background:
    Given the calendar is empty
    And today is 2026-10-12

  Scenario: A task list with only a title offers a tick box for the title
    Given the calendar contains an empty task list "Ideas" on 2026-10-14
    When I open the day view for 2026-10-14
    And I expand the task list "Ideas"
    Then the expanded task list offers a tick box for its title "Ideas"

  Scenario: Ticking the title makes it the first item, ticked
    Given the calendar contains an empty task list "Ideas" on 2026-10-14
    When I open the day view for 2026-10-14
    And I expand the task list "Ideas"
    And I tick the title of the expanded task list
    Then the expanded task list items are "Ideas"
    And the item "Ideas" is ticked
    And the expanded task list offers no tick box for its title
    When I reload the page
    And I tap the titleless task list
    Then the item "Ideas" is ticked

  Scenario: A task list with items offers no tick box for its title
    Given the calendar contains a task list "Groceries" on 2026-10-14 with items:
      | item | done |
      | Milk | no   |
    When I open the day view for 2026-10-14
    And I expand the task list "Groceries"
    Then the expanded task list offers no tick box for its title
