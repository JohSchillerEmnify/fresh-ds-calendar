@adhd @tasklists @opentasks
Feature: Open tasks stay in sight
  Out of sight is out of mind. An "open tasks" tray is visible in every view and lists today's
  and overdue task lists that still have unticked items. Open task lists from the past 30 days are
  carried forward to today with a gentle "From <day>" label instead of disappearing in the past.
  Overdue is never shown in the error color.

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And the calendar contains a task list "Laundry" on 2026-10-10 with items:
      | item  | done |
      | Wash  | yes  |
      | Fold  | no   |
    And the calendar contains a task list "Bills" on 2026-10-05 with items:
      | item  | done |
      | Rent  | yes  |
    And the calendar contains a task list "Groceries" on 2026-10-12 with items:
      | item | done |
      | Milk | no   |
    And the calendar contains a task list "Packing" on 2026-10-12 at 18:00 with items:
      | item     | done |
      | Passport | no   |
    And the calendar contains a task list "Party" on 2026-10-20 with items:
      | item  | done |
      | Cake  | no   |
    And the calendar contains a task list "Old" on 2026-09-01 with items:
      | item  | done |
      | Thing | no   |

  Scenario Outline: The open tasks tray is visible in every view
    When I open the <view> view for <period>
    Then the open tasks tray shows the count "3 open"

    Examples:
      | view  | period     |
      | month | 2026-12    |
      | week  | 2026-11-02 |
      | day   | 2026-10-25 |
      | year  | 2027       |

  Scenario: The tray lists overdue lists first, then today's lists by time
    When I open the week view for 2026-10-12
    And I open the open tasks tray
    Then the open tasks tray lists "Laundry, Groceries, Packing"

  Scenario: A task list can be opened and ticked from the tray
    When I open the month view for 2026-12
    And I open the open tasks tray
    And I open the task list "Groceries" from the open tasks tray
    Then the task list "Groceries" is expanded
    When I tick the item "Milk"
    Then the open tasks tray shows the count "2 open"

  Scenario: An overdue open task list is carried forward to today
    When I open the week view for 2026-10-05
    Then I do not see the task list "Laundry"
    And I see the task list "Bills" on 2026-10-05
    When I open the week view for 2026-10-12
    Then I see the task list "Laundry" on 2026-10-12
    And the task list "Laundry" is shown as carried over from "Sat 10 Oct"
    And the overdue label of "Laundry" does not use the error color

  Scenario Outline: Carried-over task lists appear on today in every view
    When I open the <view> view for <period>
    Then I see the task list "Laundry" on 2026-10-12

    Examples:
      | view  | period     |
      | month | 2026-10    |
      | week  | 2026-10-12 |
      | day   | 2026-10-12 |

  Scenario: Completed past task lists stay on their own day
    When I open the day view for 2026-10-05
    Then I see the task list "Bills" on 2026-10-05
    And the task list "Bills" is not flagged as overdue

  Scenario: Open task lists older than 30 days stay on their own day
    When I open the month view for 2026-09
    Then I see the task list "Old" on 2026-09-01
    When I open the week view for 2026-10-12
    Then I do not see the task list "Old"

  Scenario: Moving an overdue task list to today
    When I open the day view for 2026-10-12
    And I expand the task list "Laundry"
    And I move the task list to today
    Then the task list "Laundry" is not flagged as overdue
    And the Google event for the task list "Laundry" is an all-day event on 2026-10-12

  Scenario: Finishing a carried-over task list sends it back to its own day
    When I open the day view for 2026-10-12
    And I expand the task list "Laundry"
    And I tick the item "Fold"
    And I reload the page
    Then I do not see the task list "Laundry"
    And the open tasks tray shows the count "2 open"
    When I open the day view for 2026-10-10
    Then I see the task list "Laundry" on 2026-10-10

  Scenario: Future task lists are not in the tray
    When I open the week view for 2026-10-19
    And I open the open tasks tray
    Then the open tasks tray lists "Laundry, Groceries, Packing"
    And I see the task list "Party" on 2026-10-20

  Scenario: The tray says when everything is done
    Given the calendar is empty
    When I open the week view for 2026-10-12
    Then the open tasks tray shows the count "No open tasks"
