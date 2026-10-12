@labs @approach @id:labs-approach-bar
Feature: Labs: the approach bar
  With the approach bar switched on in the Labs settings, the "Next" line of the now card becomes a track (owner,
  2026-10-13): "now" at its start, the next three entries with a time today (events and task lists with a time) as
  small chips placed by how far away they are, the track ending at the third. As time passes the chips move towards
  "now". The other lines of the now card stay as they are.

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
    When I open the week view for 2026-10-12
    Then the approach bar shows "Dentist" in 60 minutes
    When the time is 2026-10-14 08:45
    Then "Dentist" is closer to now on the approach bar
