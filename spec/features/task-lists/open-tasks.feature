@adhd @tasklists @opentasks @id:open-tasks-in-sight
Feature: Open tasks stay in sight
  Out of sight is out of mind. An "open tasks" tray is visible in every view and lists today's
  and overdue task lists that still have unticked items. Open task lists from the past 30 days are
  carried forward to today with a gentle "From <day>" label instead of disappearing in the past; in narrow
  columns (phone week) the label shrinks to a small "carried over" badge that still names the day. The label can be
  switched off in Settings → Task lists (owner, 2026-10-14: no reminder of the past, against guilt); the list then simply
  shows up today.
  Overdue is never shown in the error color.
  Every list in the tray shows all of its items (ticked ones struck through), on phones once the tray
  is opened; long lists make the tray scroll rather than hide items. Lists finished today follow the
  open ones until the end of the day.
  A list in the tray is the same list view as the expanded list: everything that can be done there
  (tick, add, rename, reorder and delete items, rename the list, edit its details) works the same in the tray.
  Owner decision 2026-10-31 (design E, tray option C): on a phone with the view switcher at the bottom, the open tasks
  are a slim second row of the floating bottom bar, only while there are open tasks: a "3 open" chip with a chevron and
  the names of the open lists as chips that fade out where they overflow. The bar sits beside the + button, so the +
  never covers the row. Tapping the row opens the tray as before (the same list view). With no open tasks there is no
  extra row. The row belongs to the bar: it slides away with the bar while scrolling down and comes back with it.
  Left-handed mode mirrors the bar and the + button. On tablets and desktops the tray stays the side panel at the right
  (or left, left-handed), above or beside the floating bottom bar, which reserves its own room.

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

  Rule: On a phone the open tasks are a second row of the bottom bar

    @mobile
    Scenario Outline: The count and the names of the open lists are in the bottom bar in every view
      When I open the <view> view for <period>
      Then the bottom bar shows the open tasks "3 open" with the names "Laundry, Groceries, Packing"

      Examples:
        | view  | period     |
        | month | 2026-12    |
        | week  | 2026-11-02 |
        | day   | 2026-10-25 |
        | year  | 2027       |

    @mobile
    Scenario: With no open tasks the bottom bar has no extra row
      Given the calendar is empty
      When I open the week view for 2026-10-12
      Then the bottom bar has no open tasks row

    @mobile
    Scenario Outline: The + button stands beside the bar and never covers the open tasks row
      Given the bottom bar size is set to "<size>"
      When I open the week view for 2026-10-12
      Then the create button is beside the bottom bar
      And the create button does not cover any control of the open tasks tray

      Examples:
        | size       |
        | Expressive |
        | Compact    |

    @mobile
    Scenario: Left-handed mode puts the + button at the left and the bar beside it
      Given left-handed mode is on
      When I open the week view for 2026-10-12
      Then the "create button" is on the "left" side of the screen
      And the create button is beside the bottom bar

    @mobile
    Scenario: The row slides away with the bar and comes back with it
      When I open the day view for 2026-10-12
      And I scroll the calendar down by 300 pixels
      Then the bottom bar is hidden
      And the open tasks row is hidden
      When I scroll the calendar up by 60 pixels
      Then the bottom bar is shown
      And the open tasks row is shown

    @mobile
    Scenario: Tapping the row opens the tray with the same lists
      When I open the week view for 2026-10-12
      And I open the open tasks tray
      Then the open tasks tray lists "Laundry, Groceries, Packing"
      And the open tasks tray shows the count "3 open"

    @desktop @tablet
    Scenario: On wide screens the tray stays a side panel beside the floating bottom bar
      Given the view switcher on desktop and tablets is set to "bottom"
      When I open the week view for 2026-10-12
      Then the open tasks tray shows the count "3 open"
      And the calendar ends above the bottom bar

    @desktop
    Scenario: In a narrow window the open tasks are in the bottom bar, not a strip above it
      Given the browser window is 600 by 800 pixels wide and high
      When I open the week view for 2026-10-12
      Then the bottom bar shows the open tasks "3 open" with the names "Laundry, Groceries, Packing"
      And no open tasks row is outside the bottom bar

    @desktop
    Scenario: In a narrow window with no open tasks the bottom bar has no extra row
      Given the calendar is empty
      And the browser window is 600 by 800 pixels wide and high
      When I open the week view for 2026-10-12
      Then the bottom bar has no open tasks row
      And no open tasks row is outside the bottom bar

    @desktop
    Scenario: Shrinking a wide window puts the open tasks into the bottom bar
      When I open the week view for 2026-10-12
      And the browser window is 600 by 800 pixels wide and high
      Then the bottom bar shows the open tasks "3 open" with the names "Laundry, Groceries, Packing"
      And no open tasks row is outside the bottom bar

    @desktop
    Scenario: After resizing across the phone width the tray still opens and closes
      When I open the week view for 2026-10-12
      And the browser window is 600 by 800 pixels wide and high
      And the browser window is 1200 by 800 pixels wide and high
      And the browser window is 600 by 800 pixels wide and high
      And I open the open tasks tray
      Then the open tasks tray is expanded
      When I collapse the open tasks tray
      Then the open tasks tray is collapsed

  Rule: The settings pages have no open tasks tray

    Scenario: The settings page shows no open tasks tray
      When I open the week view for 2026-10-12
      And I open the settings
      Then there is no open tasks tray

  Rule: The tray itself

  Scenario: The tray lists overdue lists first, then today's lists by time
    When I open the week view for 2026-10-12
    And I open the open tasks tray
    Then the open tasks tray lists "Laundry, Groceries, Packing"

  Scenario: The tray shows every item of an open task list
    When I open the week view for 2026-10-12
    And I open the open tasks tray
    Then the open tasks tray shows the task list "Laundry" with items:
      | item | done |
      | Wash | yes  |
      | Fold | no   |

  Scenario: Finishing a task list in the tray keeps it there, struck through and collapsed
    When I open the week view for 2026-10-12
    And I open the open tasks tray
    And I tick the item "Milk" in the open tasks tray
    Then the open tasks tray shows the count "2 open"
    And the task list "Groceries" in the open tasks tray is struck through and shows only its title

  Scenario: A finished one-item task list in the tray shows no done count
    When I open the week view for 2026-10-12
    And I open the open tasks tray
    And I tick the item "Milk" in the open tasks tray
    Then the task list "Groceries" in the open tasks tray is struck through and shows only its title
    And the task list "Groceries" in the open tasks tray shows no done count

  Scenario: A task list finished earlier today stays in the tray, struck through
    Given the item "Fold" of the task list "Laundry" was ticked on 2026-10-12
    When I open the week view for 2026-10-12
    And I open the open tasks tray
    Then the task list "Laundry" in the open tasks tray is struck through and shows only its title

  Scenario: A task list finished yesterday is not in the tray
    Given the item "Fold" of the task list "Laundry" was ticked on 2026-10-11
    When I open the week view for 2026-10-12
    And I open the open tasks tray
    Then the open tasks tray lists "Groceries, Packing"

  Scenario: Unticking an item in the tray
    When I open the week view for 2026-10-12
    And I open the open tasks tray
    And I untick the item "Wash" in the open tasks tray
    Then the open tasks tray shows the task list "Laundry" with items:
      | item | done |
      | Wash | no   |
      | Fold | no   |

  Scenario: A long task list shows all of its items in the tray
    Given the calendar contains a task list "Move" on 2026-10-12 with 12 generated items
    When I open the week view for 2026-10-12
    And I open the open tasks tray
    Then the open tasks tray shows all 12 items of the task list "Move"

  Scenario: A task list in the open tasks tray can be edited like the expanded list
    When I open the day view for 2026-10-12
    And I open the open tasks tray
    And I add the item "Butter" to "Groceries" in the open tasks tray
    Then the open tasks tray shows the task list "Groceries" with items:
      | item   | done |
      | Milk   | no   |
      | Butter | no   |

  Scenario: The details of a task list in the tray are edited as in the expanded list
    When I open the month view for 2026-12
    And I open the open tasks tray
    And I edit the details of "Groceries" in the open tasks tray
    Then the task list dialog is open

  Scenario: A finished task list in the tray unfolds to its items
    Given the item "Fold" of the task list "Laundry" was ticked on 2026-10-12
    When I open the week view for 2026-10-12
    And I open the open tasks tray
    And I unfold the task list "Laundry" in the open tasks tray
    Then the open tasks tray shows the task list "Laundry" with items:
      | item | done |
      | Wash | yes  |
      | Fold | yes  |

  Scenario: The create button does not cover the open tasks tray
    When I open the week view for 2026-10-12
    And I open the open tasks tray
    Then the create button does not cover any control of the open tasks tray

  Scenario: An overdue open task list is carried forward to today
    When I open the week view for 2026-10-05
    Then I do not see the task list "Laundry"
    And I see the task list "Bills" on 2026-10-05
    When I open the week view for 2026-10-12
    Then I see the task list "Laundry" on 2026-10-12
    And the task list "Laundry" is shown as carried over from "Sat 10 Oct"
    And the overdue label of "Laundry" does not use the error color

  Scenario: Where a carried-over list comes from can be hidden
    When I hide where carried-over task lists come from in the settings
    And I open the week view for 2026-10-12
    Then I see the task list "Laundry" on 2026-10-12
    And the task list "Laundry" is not flagged as overdue

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

  # owner, 2026-11-01: a list made for a day that had already ended stays on that day; only a list made before its day ended is carried
  Scenario: An open list made after its day had ended stays on that day
    Given today is 2026-11-01
    And the calendar contains a task list "Late" on 2026-10-31 made on 2026-11-01 with items:
      | item | done |
      | Milk | no   |
    When I open the day view for 2026-10-31
    Then I see the task list "Late" on 2026-10-31
    When I open the day view for 2026-11-01
    Then I do not see the task list "Late"

  Scenario: An open list made before its day ended is carried to today
    Given today is 2026-11-01
    And the calendar contains a task list "Early" on 2026-10-31 made on 2026-10-30 with items:
      | item | done |
      | Milk | no   |
    When I open the day view for 2026-11-01
    Then I see the task list "Early" on 2026-11-01
    When I open the day view for 2026-10-31
    Then I do not see the task list "Early"

  Scenario: Open task lists older than 30 days stay on their own day
    When I open the month view for 2026-09
    Then I see the task list "Old" on 2026-09-01
    When I open the week view for 2026-10-12
    Then I do not see the task list "Old"

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

  @desktop
  Scenario: The tray says when everything is done
    Given the calendar is empty
    When I open the week view for 2026-10-12
    Then the open tasks tray shows the count "No open tasks"

  @desktop
  Scenario: The desktop tray collapses to a slim strip and opens again, also after a reload
    When I open the day view for 2026-10-12
    And I collapse the open tasks tray
    Then the open tasks tray is collapsed
    And the open tasks tray is at most 60 px wide
    And the open tasks tray shows the count "3 open"
    When I reload the app
    Then the open tasks tray is collapsed
    When I open the open tasks tray
    Then the open tasks tray is expanded
    And the open tasks tray lists "Laundry, Groceries, Packing"

  @desktop
  Scenario: Opening a list the tray already shows reveals it there instead of opening a second panel
    Given the task list tap setting is "drawer"
    When I open the day view for 2026-10-12
    And I tap the task list "Groceries"
    Then the task list "Groceries" is highlighted in the open tasks tray
    And no list sheet is open

  @desktop
  Scenario: With the tray collapsed, opening a list opens its panel as before
    Given the task list tap setting is "drawer"
    When I open the day view for 2026-10-12
    And I collapse the open tasks tray
    And I tap the task list "Groceries"
    Then the task list "Groceries" opens as the list sheet

  Scenario: A list I did not finish yesterday waits on today without a time
    Given the calendar contains a task list "Errands" on 2026-10-11 at 10:00 with items:
      | item | done |
      | Post | no   |
    When I open the day view for 2026-10-12
    Then the task list "Errands" is shown in the all-day area on 2026-10-12
