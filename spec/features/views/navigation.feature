@navigation @id:navigation
Feature: Navigation and view switching
  The calendar has a month, a week (Monday to Sunday) and a day view.
  Every view has a deep-linkable URL: /month/YYYY-MM, /week/YYYY-MM-DD (Monday), /day/YYYY-MM-DD.
  "Today" always comes from the app clock, which tests fix with "Given today is ...".
  Desktop with a mouse moves through the periods with the ‹ › arrows in the top bar; phones and touch tablets have no
  arrows and move by swiping the calendar (owner, 2026-10-26); Today is everywhere.

  Background:
    Given the calendar is empty
    And today is 2026-10-12

  @month
  Scenario: Opening the app shows the current month
    When I open the app
    Then the month view is shown
    And the URL path is "/month/2026-10"
    And the period title is "October 2026"

  @month
  Scenario: Month grid weeks start on Monday and include adjacent-month days
    When I open the month view for 2026-10
    Then the weekday headers are "Mon, Tue, Wed, Thu, Fri, Sat, Sun"
    And the month grid starts on 2026-09-28 and ends on 2026-11-01
    And 2026-09-30 is shown as outside the current month
    And 2026-10-01 is shown as inside the current month
    And 2026-11-01 is shown as outside the current month

  @month
  Scenario: Month grid grows to six weeks when needed
    When I open the month view for 2026-11
    Then the month grid starts on 2026-10-26 and ends on 2026-12-06

  @week
  Scenario: Week view shows Monday to Sunday
    When I open the week view for 2026-10-12
    Then the week view is shown
    And the week columns are "Mon 12, Tue 13, Wed 14, Thu 15, Fri 16, Sat 17, Sun 18"
    And the period title is "12 – 18 Oct 2026"

  @week
  Scenario: A week URL with a non-Monday date is normalised to its Monday
    When I open the path "/week/2026-10-15"
    Then the week view is shown
    And the URL path is "/week/2026-10-12"

  @week
  Scenario Outline: Week titles across month and year boundaries
    When I open the week view for <monday>
    Then the period title is "<title>"

    Examples:
      | monday     | title                      |
      | 2026-09-28 | 28 Sep – 4 Oct 2026        |
      | 2026-12-28 | 28 Dec 2026 – 3 Jan 2027   |

  @day
  Scenario: Day view shows a single day
    When I open the day view for 2026-10-14
    Then the day view is shown
    And the period title is "Wednesday, 14 October 2026"

  Scenario Outline: Deep links open the right view directly
    When I open the path "<path>"
    Then the <view> view is shown
    And the period title is "<title>"

    Examples:
      | path             | view  | title                   |
      | /month/2026-10   | month | October 2026            |
      | /week/2026-10-12 | week  | 12 – 18 Oct 2026        |
      | /day/2026-10-12  | day   | Monday, 12 October 2026 |
      | /month/2027-02   | month | February 2027           |

  Scenario Outline: Invalid deep links redirect to the current month
    When I open the path "<path>"
    Then the URL path is "/month/2026-10"
    And the month view is shown

    Examples:
      | path              |
      | /month/2026-13    |
      | /week/not-a-date  |
      | /day/2026-02-30   |
      | /unknown          |

  # the ‹ › arrows are a desktop control: touch screens have none and move by swiping (owner, 2026-10-26)
  @desktop
  Scenario Outline: Previous and next move by exactly one period
    When I open the <view> view for <start>
    And I go to the next period
    Then the URL path is "<next>"
    When I go to the previous period
    And I go to the previous period
    Then the URL path is "<previous>"

    Examples:
      | view  | start      | next             | previous         |
      | month | 2026-10    | /month/2026-11   | /month/2026-09   |
      | month | 2026-12    | /month/2027-01   | /month/2026-11   |
      | week  | 2026-10-12 | /week/2026-10-19 | /week/2026-10-05 |
      | week  | 2026-12-28 | /week/2027-01-04 | /week/2026-12-21 |
      | day   | 2026-10-12 | /day/2026-10-13  | /day/2026-10-11  |
      | day   | 2026-12-31 | /day/2027-01-01  | /day/2026-12-30  |

  # owner, 2026-10-26: phones and touch tablets have no ‹ › arrows; Today stays, a swipe moves through the periods
  @mobile
  Scenario Outline: On a touch screen a swipe goes to the next or previous period and no arrows are shown
    When I open the <view> view for <start>
    Then the top bar shows no arrows
    When I swipe left on the calendar
    Then the URL path is "<next>"
    When I swipe right on the calendar
    And I swipe right on the calendar
    Then the URL path is "<previous>"

    Examples:
      | view  | start      | next             | previous         |
      | month | 2026-10    | /month/2026-11   | /month/2026-09   |
      | week  | 2026-10-12 | /week/2026-10-19 | /week/2026-10-05 |
      | day   | 2026-12-31 | /day/2027-01-01  | /day/2026-12-30  |

  Scenario Outline: The today button returns to the period containing today
    When I open the <view> view for <other>
    And I go to today
    Then the URL path is "<today>"
    And 2026-10-12 is highlighted as today

    Examples:
      | view  | other      | today            |
      | month | 2027-03    | /month/2026-10   |
      | week  | 2026-11-23 | /week/2026-10-12 |

  # The day view has no day header any more (feature header-layout): its today highlight is the Today button's.
  Scenario: The today button returns to today's day view
    When I open the day view for 2026-12-24
    And I go to today
    Then the URL path is "/day/2026-10-12"

  Scenario Outline: The current day is highlighted in every view
    When I open the <view> view for <period>
    Then 2026-10-12 is highlighted as today
    And exactly one day is highlighted as today

    Examples:
      | view  | period     |
      | month | 2026-10    |
      | week  | 2026-10-12 |

  Scenario Outline: No day is highlighted when today is not visible
    When I open the <view> view for <period>
    Then no day is highlighted as today

    Examples:
      | view  | period     |
      | month | 2026-12    |
      | week  | 2026-10-19 |

  # owner, 2026-10-26: the date is shown once, so the day view's "Mon 12" header goes; the Today button takes over its
  # today highlight in every view: filled while today is shown, outlined on a solid background when it is not.
  @backlog
  Scenario Outline: The Today button shows when today is on screen
    When I open the <view> view for <period>
    Then the Today button shows that today is on screen

    Examples:
      | view  | period     |
      | month | 2026-10    |
      | week  | 2026-10-12 |
      | day   | 2026-10-12 |

  @backlog
  Scenario Outline: The Today button does not show it when today is not on screen
    When I open the <view> view for <period>
    Then the Today button does not show that today is on screen

    Examples:
      | view  | period     |
      | month | 2026-12    |
      | week  | 2026-10-19 |
      | day   | 2026-10-13 |

  @backlog
  Scenario: Going to today in the day view lights up the Today button
    When I open the day view for 2026-12-24
    And I go to today
    Then the Today button shows that today is on screen

  Scenario Outline: Switching views keeps today when it is visible, otherwise the focused date
    When I open the month view for <month>
    And I switch to the week view
    Then the URL path is "<week>"
    When I switch to the day view
    Then the URL path is "<day>"
    When I switch to the month view
    Then the URL path is "/month/<month>"

    Examples:
      | month   | week             | day             |
      | 2026-10 | /week/2026-10-12 | /day/2026-10-12 |
      | 2026-12 | /week/2026-11-30 | /day/2026-12-01 |

  Scenario: Switching from a day view to the week view shows the week containing that day
    When I open the day view for 2026-10-17
    And I switch to the week view
    Then the URL path is "/week/2026-10-12"

  Scenario: Browser back returns to the previous period
    When I open the month view for 2026-10
    And I go to the next period
    And I go back in the browser
    Then the URL path is "/month/2026-10"
    And the period title is "October 2026"

  @month @desktop
  Scenario: Clicking a day number in the month view opens that day
    When I open the month view for 2026-10
    And I click the day number of 2026-10-14
    Then the URL path is "/day/2026-10-14"

  @month @desktop
  Scenario: Clicking empty space in a month day cell opens that day
    When I open the month view for 2026-10
    And I click empty space in the month cell of 2026-10-20
    Then the URL path is "/day/2026-10-20"

  @month @desktop
  Scenario: Clicking an entry in a month day cell opens the entry, not the day
    Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    When I open the month view for 2026-10
    And I open the event "Dentist"
    Then the event dialog is open
    And the URL path is "/month/2026-10"

  @week
  Scenario: Tapping a week column header opens that day
    When I open the week view for 2026-10-12
    And I click the week header of 2026-10-16
    Then the URL path is "/day/2026-10-16"

  Rule: Going back closes the topmost open overlay first

    @mobile
    Scenario: Going back closes the open task list instead of leaving the view
      Given I am using a phone
      And the calendar contains a task list "Groceries" on 2026-10-14 with items:
        | item | done |
        | Milk | no   |
      When I open the week view for 2026-10-12
      And I expand the task list "Groceries"
      And I go back in the browser
      Then the task list "Groceries" is collapsed
      And the URL path is "/week/2026-10-12"

    @mobile
    Scenario: Going back with the open tasks tray expanded collapses the tray
      Given I am using a phone
      When I open the week view for 2026-10-12
      And I open the open tasks tray
      And I go back in the browser
      Then the open tasks tray is collapsed
      And the URL path is "/week/2026-10-12"

