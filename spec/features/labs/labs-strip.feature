@labs @strip @id:labs-strip
Feature: Labs: the strip view
  The strip view shows days side by side as columns that scroll sideways without end, snapping to whole days.

  Background:
    Given the calendar is empty
    And today is 2026-10-14
    And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00

  Scenario: The strip shows days side by side and scrolls on endlessly
    When I open the strip view for 2026-10-14
    Then I see the event "Dentist" in the strip column of 2026-10-14
    When I scroll the strip one day to the right
    Then the strip column of 2026-10-15 is in front
    And the page did not reload

  Scenario: Strip columns show time to scale
    Given the calendar contains an event "Workshop" on 2026-10-14 from 13:00 to 16:00
    And the calendar contains an all-day event "Trip" on 2026-10-14
    When I open the strip view for 2026-10-14
    Then in the strip "Workshop" is about 3 times as tall as "Dentist"
    And "Trip" is in the strip's all-day band

  Scenario: Strip columns line up on one time scale
    Given the calendar contains an all-day event "Trip" on 2026-10-14
    When I open the strip view for 2026-10-14
    Then the hour lines of the strip columns of 2026-10-14 and 2026-10-15 are at the same height
    And the all-day bands of the strip columns of 2026-10-14 and 2026-10-15 are equally tall

