@labs @approach @id:labs-approach-bar
Feature: Labs: the approach bar
  With the approach bar switched on in the Labs settings, the "Next" line of the now card becomes a track (owner,
  2026-10-13): "now" at its start and a fixed time window ahead (3, 6 or 12 hours, chosen in the settings, 3 by
  default), marked with times that thin out as the window grows. The next three entries with a time today (events
  and task lists with a time) within the window sit on it as small chips at their start time and move towards "now"
  as time passes. When nothing is within the window, the next entry waits at the end of the track. No "Next:" text
  is shown while the track is on; the other lines of the now card stay as they are.

  Background:
    Given the calendar is empty
    And today is 2026-10-14
    And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00

  Scenario: The approach bar shows the next three entries with a time
    Given the time is 2026-10-14 08:00
    And the calendar contains a task list "Groceries" on 2026-10-14 at 10:00 with items:
      | Milk |
    And the calendar contains an event "Gym" on 2026-10-14 from 11:00 to 12:00
    And the calendar contains an event "Lunch" on 2026-10-14 from 12:30 to 13:00
    When I turn on the approach bar and open the week view for 2026-10-12
    Then the approach bar shows "Dentist", "Groceries" and "Gym" in this order

  Scenario: The next entry comes closer as time passes
    Given the time is 2026-10-14 08:00
    And the approach bar is on
    And the calendar contains an event "Gym" on 2026-10-14 from 11:00 to 12:00
    When I open the week view for 2026-10-12
    Then the approach bar shows "Dentist" in 60 minutes
    When the time is 2026-10-14 08:45
    Then "Dentist" is closer to now on the approach bar

  Scenario: An entry beyond the window waits at the end of the track
    Given the time is 2026-10-14 05:00
    And the approach bar is on
    When I open the week view for 2026-10-12
    Then the approach bar shows "Dentist" at its end

  Scenario: A longer window reaches further ahead
    Given the time is 2026-10-14 08:00
    And the calendar contains an event "Lunch" on 2026-10-14 from 12:30 to 13:00
    And the approach bar is on with a window of 6 hours
    When I open the week view for 2026-10-12
    Then the approach bar shows "Dentist" and "Lunch"
