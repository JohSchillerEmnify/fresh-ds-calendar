@labs @clock @id:labs-clock
Feature: Labs: experimental views and the 24-hour clock
  Experimental views are tried out behind a Labs switch in the settings: when it is on, the view switcher offers them,
  marked as experimental; when it is off, nothing changes. The clock view shows one day as a 24-hour circle: events are
  arcs from their start to their end, task lists are dots at their time, and a hand points at the current time.

  Background:
    Given the calendar is empty
    And today is 2026-10-14
    And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00

  Scenario: Experimental views appear only with Labs on
    When I open the week view for 2026-10-12
    And I turn on experimental views in the settings
    Then the view switcher offers "Clock", "Timeline" and "Strip" marked as experimental

  Scenario: The clock shows the day as a 24-hour circle
    Given the time is 2026-10-14 09:30
    When I open the clock view for 2026-10-14
    Then the event "Dentist" is an arc from 09:00 to 10:00
    And the clock hand points at 09:30

  Scenario: The clock names each event
    When I open the clock view for 2026-10-14
    Then the arc of "Dentist" is labelled "Dentist"

  Scenario: Moving in time stays on the clock, switching to Day leaves it
    When I open the clock view for 2026-10-14
    And I go to the next period
    Then the URL path is "/clock/2026-10-15"
    When I switch to the day view
    Then the URL path is "/day/2026-10-15"
