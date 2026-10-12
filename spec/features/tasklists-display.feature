@tasklists @display
Feature: Task lists in the calendar views
  A task list is placed on a date, optionally at a time. Collapsed it shows its title,
  its item titles in a compact single line and a done count like "1/3". A timed task list's place in the time
  grid tells its time; a short block does not repeat it as text.
  On phones, the month view shows only compact chips; tapping the day opens the day view.

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And the calendar contains a task list "Groceries" on 2026-10-14 with items:
      | item  | done |
      | Milk  | yes  |
      | Eggs  | no   |
      | Bread | no   |

  Scenario Outline: A task list appears in every view
    When I open the <view> view for <period>
    Then I see the task list "Groceries" on 2026-10-14

    Examples:
      | view  | period     |
      | month | 2026-10    |
      | week  | 2026-10-12 |
      | day   | 2026-10-14 |

  Scenario Outline: A collapsed task list shows title, item titles and done count
    When I open the <view> view for <period>
    Then the task list "Groceries" is collapsed
    And the collapsed task list "Groceries" lists the items "Milk, Eggs, Bread"
    And the task list "Groceries" shows the done count "1/3"

    Examples:
      | view  | period     |
      | week  | 2026-10-12 |
      | day   | 2026-10-14 |

  @month @desktop
  Scenario: A collapsed task list in the desktop month view shows items and done count
    When I open the month view for 2026-10
    Then the collapsed task list "Groceries" lists the items "Milk, Eggs, Bread"
    And the task list "Groceries" shows the done count "1/3"

  @week
  Scenario: A task list without a time is shown in the all-day area
    When I open the week view for 2026-10-12
    Then the task list "Groceries" is shown in the all-day area on 2026-10-14

  Scenario Outline: A task list with a time is placed in the time grid
    Given the calendar contains a task list "Packing" on 2026-10-15 at 18:00 with items:
      | item     | done |
      | Passport | no   |
    When I open the <view> view for <period>
    Then the task list "Packing" is positioned at 18:00

    Examples:
      | view | period     |
      | week | 2026-10-12 |
      | day  | 2026-10-15 |

  Scenario: An empty task list shows a zero count and a placeholder
    Given the calendar contains an empty task list "Ideas" on 2026-10-14
    When I open the day view for 2026-10-14
    Then the task list "Ideas" shows the done count "0/0"
    And the collapsed task list "Ideas" shows "No items"

  Scenario: A task list on another day is not shown in the day view
    When I open the day view for 2026-10-13
    Then I do not see the task list "Groceries"

  Scenario Outline: Tapping a collapsed task list expands it
    When I open the <view> view for <period>
    And I expand the task list "Groceries"
    Then the task list "Groceries" is expanded
    And the expanded task list items are "Milk, Eggs, Bread"
    And the item "Milk" is ticked
    And the item "Eggs" is not ticked
    When I collapse the task list
    Then the task list "Groceries" is collapsed

    Examples:
      | view | period     |
      | week | 2026-10-12 |
      | day  | 2026-10-14 |

  @month @desktop
  Scenario: Expanding a task list from the desktop month view
    When I open the month view for 2026-10
    And I expand the task list "Groceries"
    Then the task list "Groceries" is expanded

  Scenario: Escape collapses an expanded task list
    When I open the day view for 2026-10-14
    And I expand the task list "Groceries"
    And I press Escape
    Then the task list "Groceries" is collapsed

  Scenario: A task list created in Google with only a description is still readable
    Given Google contains a raw task list event "Legacy" on 2026-10-14 with the description:
      """
      ☑ Call bank
      ☐ Pay rent
      """
    When I open the day view for 2026-10-14
    Then the collapsed task list "Legacy" lists the items "Call bank, Pay rent"
    And the task list "Legacy" shows the done count "1/2"
