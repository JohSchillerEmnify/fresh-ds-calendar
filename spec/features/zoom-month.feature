@labs @zoom-month @id:zoom-month
Feature: Labs: the zoom month
  The zoom month is the month grid on a surface you can zoom without steps. The days get larger as you zoom in and
  show more and more: density dots, then title chips, then start times and task lists with their open items, and in the
  biggest cells a small day timeline with every task item. Pinch (touch), Ctrl or Cmd with the wheel (desktop) and the
  zoom buttons change the zoom around the gesture point; a drag or the wheel pans. "The whole month fits" is the
  smallest zoom, one day as wide as the screen the largest. The zoom is remembered for the session only.

  Background:
    Given the calendar is empty
    And today is 2026-10-14
    And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    And the calendar contains a task list "Groceries" on 2026-10-14 with items:
      | item  | done |
      | Milk  | no   |
      | Bread | no   |

  Scenario: Opening the zoom month shows the month
    When I open the zoom month for 2026-10-14
    Then the zoom month shows "October 2026"
    And the zoom month shows the whole month
    And the zoom month cell of 2026-10-14 has 2 entries

  Scenario: Zooming in shows more detail
    When I open the zoom month for 2026-10-14
    Then the zoom month shows no start times
    When I zoom the zoom month in until the start times show
    Then "Dentist" shows its start time "09:00" in the zoom month
    When I zoom the zoom month in until the task list items show
    Then the task list "Groceries" shows the item "Milk" in the zoom month

  Scenario: Zoom buttons work
    When I open the zoom month for 2026-10-14
    And I press the zoom in button of the zoom month
    Then the zoom month is zoomed in
    When I press the zoom out button of the zoom month
    Then the zoom month shows the whole month

  Scenario: Ctrl with the wheel zooms and the zoom is remembered for the session
    When I open the zoom month for 2026-10-14
    And I zoom the zoom month in with Ctrl+wheel
    Then the zoom month is zoomed in
    When I reload the page
    Then the zoom month is zoomed in

  Scenario: Tapping a day opens the day view
    When I open the zoom month for 2026-10-14
    And I tap the day number 2026-10-14 in the zoom month
    Then the URL path is "/day/2026-10-14"

  Scenario: Task lists in the zoom month are not hidden behind events
    Given the calendar contains a task list "Dinner call" on 2026-10-14 at 17:00 for 15 minutes with items:
      | item  | done |
      | Table | no   |
    And the calendar contains an event "Abend zu zweit" on 2026-10-14 from 17:15 to 21:30
    And the calendar contains an event "Late show" on 2026-10-14 from 19:00 to 22:00
    When I open the zoom month for 2026-10-14
    And I zoom the zoom month in to the largest zoom
    Then the title of the task list "Dinner call" is on top in the zoom month
    And the title of the task list "Groceries" is on top in the zoom month

  Scenario: Zoomed in, items are laid out by their real time
    Given the calendar contains an event "Abend zu zweit" on 2026-10-14 from 17:15 to 21:30
    And the calendar contains an event "Late show" on 2026-10-14 from 19:00 to 22:00
    When I open the zoom month for 2026-10-14
    And I zoom the zoom month in to the largest zoom
    Then "Late show" is drawn lower than "Abend zu zweit" in the zoom month
    And the zoom month heights of "Abend zu zweit" and "Late show" are proportional to their durations
