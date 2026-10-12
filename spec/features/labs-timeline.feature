@labs @timeline-view @id:labs-timeline
Feature: Labs: the timeline view
  The timeline view puts every event and task list on one continuous line across days, spaced by time, with a marker
  for now. It can be zoomed in and out.

  Background:
    Given the calendar is empty
    And today is 2026-10-14
    And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00

  Scenario: The timeline puts everything on one line
    Given the time is 2026-10-14 08:00
    And the calendar contains an event "Gym" on 2026-10-15 from 18:00 to 19:00
    When I open the timeline view
    Then "Dentist" comes before "Gym" on the timeline
    And the now marker is before "Dentist" on the timeline
    And on the timeline "Gym" is farther from "Dentist" than "Dentist" is from the now marker

  Scenario: Longer events take more room on the timeline
    Given the calendar contains an event "Workshop" on 2026-10-14 from 13:00 to 16:00
    When I open the timeline view
    Then on the timeline "Workshop" is about 3 times as long as "Dentist"

  Scenario: All-day entries sit in their own band above the timeline
    Given the calendar contains an all-day event "Trip" on 2026-10-15
    When I open the timeline view
    Then "Trip" is in the all-day band above the timed entries

  Scenario: The timeline runs top to bottom and titles read normally
    Given the time is 2026-10-14 08:00
    When I open the timeline view
    Then the timeline runs from top to bottom
    And the title of "Dentist" on the timeline reads left to right in one line

