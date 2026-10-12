@labs @approach @id:labs-approach-bar
Feature: Labs: the approach bar
  An optional bar above every calendar view shows the next three hours as a short line with "now" at the start; the
  next event sits on it and moves closer to "now" as its start approaches. It is switched on in the Labs settings.

  Background:
    Given the calendar is empty
    And today is 2026-10-14
    And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00

  Scenario: The approach bar shows the next event coming closer
    Given the time is 2026-10-14 08:00
    And the approach bar is on
    When I open the week view for 2026-10-12
    Then the approach bar shows "Dentist" in 60 minutes
    When the time is 2026-10-14 08:45
    Then "Dentist" is closer to now on the approach bar
