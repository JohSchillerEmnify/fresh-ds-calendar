@labs @horizontal @id:horizontal-time
Feature: Labs: the horizontal view
  In the horizontal view time runs from left to right. The week has one row per day with the hours as columns, the day is
  one row with lanes for overlapping entries. Cards get wider instead of taller, so a task list has room for its items.
  Time (pixels per hour) and the days (row height) zoom independently: pinch zooms both, Ctrl or Cmd with the wheel zooms
  time, Shift+Ctrl or Alt with the wheel zooms the day height, and each axis has its + and - buttons. The surface pans
  sideways and down by drag or wheel. The hour axis on top and the day labels on the left stay in view. The zoom is
  remembered for the session only.

  Background:
    Given the calendar is empty
    And today is 2026-10-14
    And the calendar contains an event "Dentist" on 2026-10-14 from 10:00 to 11:00
    And the calendar contains an event "Lunch" on 2026-10-14 from 14:00 to 15:00

  Scenario: The horizontal week shows days as rows and hours left to right
    When I open the horizontal view for 2026-10-14
    Then the horizontal view shows 7 day rows
    And in the horizontal view "Dentist" is left of "Lunch" in the same row

  Scenario: The horizontal day shows one row with the hours left to right
    When I open the horizontal day view for 2026-10-14
    Then the horizontal view shows 1 day rows
    And in the horizontal view "Dentist" is left of "Lunch" in the same row

  Scenario: Zooming time makes events wider
    When I open the horizontal view for 2026-10-14
    And I note the width of "Dentist" in the horizontal view
    And I zoom the horizontal view in time with Ctrl+wheel
    Then "Dentist" is wider in the horizontal view than noted
    When I reload the page
    Then the horizontal view is zoomed in time

  Scenario: Zooming days makes rows taller
    When I open the horizontal view for 2026-10-14
    And I note the height of the day rows of the horizontal view
    And I zoom the horizontal view in days with Alt+wheel
    Then the day rows of the horizontal view are taller than noted

  Scenario: The zoom buttons work for each axis
    When I open the horizontal view for 2026-10-14
    And I note the width of "Dentist" in the horizontal view
    And I note the height of the day rows of the horizontal view
    And I press the horizontal view's time zoom in button
    Then "Dentist" is wider in the horizontal view than noted
    When I press the horizontal view's day zoom in button
    Then the day rows of the horizontal view are taller than noted

  Scenario: Scrolling sideways reaches the evening
    When I open the horizontal view for 2026-10-14
    Then the horizontal view does not show the hour 18:00
    When I scroll the horizontal view sideways
    Then the horizontal view shows the hour 18:00

  Scenario: Overlapping events get separate lanes
    Given the calendar contains an event "Review" on 2026-10-15 from 10:00 to 12:00
    And the calendar contains an event "Design" on 2026-10-15 from 11:00 to 13:00
    When I open the horizontal view for 2026-10-14
    Then in the horizontal view "Review" and "Design" are in separate lanes of the same row

  Scenario: Tapping a day label opens the day view
    When I open the horizontal view for 2026-10-14
    And I tap the day label 2026-10-14 in the horizontal view
    Then the URL path is "/day/2026-10-14"

  Scenario: A task list is as long as it lasts and opens like in the week view
    Given the calendar contains a task list "Groceries" on 2026-10-14 at 08:00 for 120 minutes with items:
      | item  | done |
      | Milk  | no   |
      | Bread | no   |
    When I open the horizontal view for 2026-10-14
    And I zoom the horizontal view in time with Ctrl+wheel
    Then in the horizontal view "Groceries" is about 2 times as wide as "Dentist"
    When I tap the task list "Groceries"
    Then the task list "Groceries" is expanded over the calendar
    When I tap the expanded task list "Groceries"
    Then the task list "Groceries" opens as the list sheet
