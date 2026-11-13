@picker @navigation @id:month-picker
Feature: Month picker in the top app bar
  Tapping the period title opens an expanding mini-month picker (like the Google Calendar app,
  in Material 3 style). Arrows or a horizontal swipe change the month; days with items carry a dot;
  tapping a day jumps the current view to it and closes the picker.

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00

  Scenario: Open and close the picker from the period title
    When I open the month view for 2026-10
    And I open the month picker
    Then the month picker is open
    And the month picker shows "October 2026"
    And 2026-10-12 is selected in the month picker
    And 2026-10-14 is marked as having items in the month picker
    And 2026-10-13 is not marked as having items in the month picker
    When I open the month picker
    Then the month picker is closed

  Scenario: Escape closes the picker
    When I open the week view for 2026-10-12
    And I open the month picker
    And I press Escape
    Then the month picker is closed

  @visual @mobile
  Scenario Outline: The open month picker looks as drawn, light and dark
    Given the device prefers a <scheme> color scheme
    When I open the month view for 2026-10
    And I open the month picker
    Then the "month picker" still looks like "month-picker-<scheme>"

    Examples:
      | scheme |
      | light  |
      | dark   |

  # the picker is an AdaptiveSheet strip under the top app bar: Back, Escape and a tap beside it all close it
  Scenario: The browser Back button closes the picker
    When I open the week view for 2026-10-12
    And I open the month picker
    And I go back in the browser
    Then the month picker is closed
    And the URL path is "/week/2026-10-12"

  Scenario: Arrows and swipes change the month inside the picker
    When I open the month view for 2026-10
    And I open the month picker
    And I go to the next month in the month picker
    Then the month picker shows "November 2026"
    And the URL path is "/month/2026-10"
    When I swipe right in the month picker
    And I swipe right in the month picker
    Then the month picker shows "September 2026"
    When I swipe left in the month picker
    Then the month picker shows "October 2026"
    When I go to the previous month in the month picker
    Then the month picker shows "September 2026"

  # a mouse drag has no time limit (a slow, deliberate drag still turns the month); the touch swipe stays a quick flick
  @desktop
  Scenario: A slow mouse drag changes the month inside the picker
    When I open the month view for 2026-10
    And I open the month picker
    And I slowly drag left with the mouse in the month picker
    Then the month picker shows "November 2026"

  Scenario Outline: Picking a day jumps the current view to it
    When I open the <view> view for <period>
    And I open the month picker
    And I go to the next month in the month picker
    And I pick 2026-11-18 in the month picker
    Then the month picker is closed
    And the URL path is "<path>"

    Examples:
      | view  | period     | path             |
      | month | 2026-10    | /month/2026-11   |
      | week  | 2026-10-12 | /week/2026-11-16 |
      | day   | 2026-10-12 | /day/2026-11-18  |

  Scenario: The picked day becomes the focused day
    When I open the month view for 2026-10
    And I open the month picker
    And I go to the next month in the month picker
    And I pick 2026-11-18 in the month picker
    And I switch to the day view
    Then the URL path is "/day/2026-11-18"

  Scenario: The picker starts at the month of the shown period
    When I open the day view for 2027-02-03
    And I open the month picker
    Then the month picker shows "February 2027"
    And 2027-02-03 is selected in the month picker

  @mobile
  Scenario: Opening the month picker never scrolls the page
    When I open the month view for 2026-10
    And I open the month picker
    And I drag up and down inside the month picker
    Then the page is not scrolled
    And the bottom bar ends at the bottom of the viewport
