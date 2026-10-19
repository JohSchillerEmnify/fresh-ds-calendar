@mobile
Feature: Mobile-first layout
  Phones (375–430 px portrait) are the primary target. These scenarios run only in the
  phone test configuration (375×812, touch, mobile user agent).
  On phones: thumb-reachable bottom bar with the view switcher, floating "+" button,
  touch targets of at least 44×44 px, swipe left/right to change period, bottom-sheet dialogs,
  no horizontal page scroll, safe-area insets respected.

  Background:
    Given I am using a phone
    And the calendar is empty
    And the expanding task-list cards experiment is on
    And today is 2026-10-12

  Scenario Outline: No horizontal page scroll in any view
    Given the calendar contains an event "A very long event title that would overflow a narrow column" on 2026-10-14 from 09:00 to 10:00
    And the calendar contains a task list "Groceries with a really long title" on 2026-10-14 with items:
      | item                                   | done |
      | An item with an unreasonably long name | no   |
    When I open the <view> view for <period>
    Then the page has no horizontal scroll

    Examples:
      | view  | period     |
      | month | 2026-10    |
      | week  | 2026-10-12 |
      | day   | 2026-10-14 |

  Scenario: Month view on a phone shows the day's events in the cell
    Given the calendar contains an all-day event "Trip" from 2026-08-10 to 2026-08-14
    And the calendar contains an all-day event "Conference" from 2026-08-11 to 2026-08-13
    And the calendar contains an all-day event "Camp" from 2026-08-12 to 2026-08-16
    And the calendar contains an event "Meeting" on 2026-08-12 from 10:00 to 11:00
    When I open the month view for 2026-08
    Then the month cell of 2026-08-12 shows its first entry
    And I see the all-day event "Trip" on 2026-08-12

  Scenario: Multi-day bars stay visible in a crowded month on a small phone
    Given I am using Safari on an iPhone
    And the browser window is 390 by 664 pixels wide and high
    And the calendar contains an all-day event "Trip" from 2026-08-10 to 2026-08-14
    And the calendar contains an all-day event "Conference" from 2026-08-11 to 2026-08-13
    And the calendar contains an all-day event "Camp" from 2026-08-12 to 2026-08-16
    And the calendar contains an event "Meeting" on 2026-08-12 from 10:00 to 11:00
    When I open the month view for 2026-08
    Then I see the event "Trip" as a bar from 2026-08-10 to 2026-08-14

  Scenario: The view switcher sits in a bottom bar within thumb reach
    When I open the month view for 2026-10
    Then the view switcher is at the bottom of the screen
    And the create button is at the bottom of the screen

  Scenario: Touch targets are at least 44 by 44 pixels
    When I open the week view for 2026-10-12
    Then the navigation, view switcher and create buttons are at least 44 by 44 pixels

  Scenario: While swiping, the next period comes along with the finger
    When I open the week view for 2026-10-12
    And I start swiping left on the calendar by a quarter of the width
    Then the week of 2026-10-19 is shown beside the current one
    When I let go
    Then the URL path is "/week/2026-10-12"

  Scenario: A swipe past a third settles on the next period
    When I open the week view for 2026-10-12
    And I start swiping left on the calendar by half the width
    And I let go
    Then the URL path is "/week/2026-10-19"

  Scenario Outline: Swiping left shows the next period, swiping right the previous one
    When I open the <view> view for <start>
    And I swipe left on the calendar
    Then the URL path is "<next>"
    When I swipe right on the calendar
    And I swipe right on the calendar
    Then the URL path is "<previous>"

    Examples:
      | view  | start      | next             | previous         |
      | month | 2026-10    | /month/2026-11   | /month/2026-09   |
      | week  | 2026-10-12 | /week/2026-10-19 | /week/2026-10-05 |
      | day   | 2026-10-12 | /day/2026-10-13  | /day/2026-10-11  |

  Scenario: A vertical swipe scrolls and does not change the period
    When I open the day view for 2026-10-12
    And I swipe up on the calendar
    Then the URL path is "/day/2026-10-12"

  Scenario: Navigation buttons work as an alternative to swiping
    When I open the week view for 2026-10-12
    And I go to the next period
    Then the URL path is "/week/2026-10-19"
    When I go to today
    Then the URL path is "/week/2026-10-12"

  Scenario: The phone month view shows compact chips and tapping a day opens its agenda
    Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    When I open the month view for 2026-10
    Then I see the event "Dentist" on 2026-10-14
    When I tap the day 2026-10-14 in the month view
    Then the URL path is "/day/2026-10-14"
    And the event "Dentist" is positioned from 09:00 to 10:00

  Scenario: Dialogs are bottom sheets on phones
    When I open the week view for 2026-10-12
    And I start creating an event
    Then the event dialog is shown as a bottom sheet
    And the event dialog fits within the viewport

  Scenario: Create an event on a phone
    When I open the day view for 2026-10-14
    And I start creating an event
    And I fill in the event form with:
      | title      | Dentist    |
      | start date | 2026-10-14 |
      | start time | 09:00      |
      | end time   | 10:00      |
    And I save the event
    Then the event "Dentist" is positioned from 09:00 to 10:00

  Scenario: Expand a task list over the calendar and tick an item on a phone
    Given the calendar contains a task list "Groceries" on 2026-10-14 with items:
      | item | done |
      | Milk | no   |
      | Eggs | no   |
    When I open the day view for 2026-10-14
    And I expand the task list "Groceries"
    And the expanded task list fits within the viewport
    When I tick the item "Milk"
    Then the task list "Groceries" shows the done count "1/2"

  Scenario: The layout respects safe-area insets
    When I open the app
    Then the viewport meta tag contains "viewport-fit=cover"
    And the bottom bar reserves the safe-area inset at the bottom

  Scenario: Pinching the week zooms the time grid and is remembered
    When I open the week view for 2026-10-12
    And I pinch out on the time grid to twice the size
    Then one hour of the time grid is about twice as tall as before
    When I reload the page
    Then one hour of the time grid is still about twice as tall as at the start
