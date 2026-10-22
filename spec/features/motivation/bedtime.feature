@bedtime @id:bedtime
Feature: Bedtime mode
  A person can switch on bedtime mode in the settings (off by default). Then every timeline-type view (the day and week
  time grid, the Timeline, the Strip, the Clock and the Approaching track) shows a dark night band with a moon from
  bedtime to wake-up; events stay visible and tappable. Bedtime and wake-up are fixed times, or follow the first timed
  appointment of the next day (never later than the fixed times). A snackbar reminds the person a few minutes before
  bedtime, once per night.

  Background:
    Given the calendar is empty
    And today is 2026-10-14

  Scenario: Fixed times show a night band in the day view
    Given the time is 2026-10-14 12:00
    And bedtime mode is on with fixed times 23:00 and 07:00
    When I open the day view for 2026-10-14
    Then the night bands of 2026-10-14 are "00:00-07:00, 23:00-24:00"
    And the night band runs from 2026-10-14 23:00 to 2026-10-15 07:00

  Scenario: The band continues across midnight in the week view
    Given the time is 2026-10-14 12:00
    And bedtime mode is on with fixed times 23:00 and 07:00
    When I open the week view for 2026-10-12
    Then the night bands of 2026-10-14 are "00:00-07:00, 23:00-24:00"
    And the night bands of 2026-10-15 are "00:00-07:00, 23:00-24:00"

  Scenario: The first appointment moves bedtime earlier
    Given the time is 2026-10-14 12:00
    And the calendar contains an event "Dentist" on 2026-10-15 from 07:30 to 08:30
    And bedtime mode is on based on my first appointment with 8 hours of sleep and 60 minutes of lead time
    When I open the day view for 2026-10-14
    Then the night band runs from 2026-10-14 22:30 to 2026-10-15 06:30

  Scenario: The first appointment never makes bedtime later than the fixed time
    Given the time is 2026-10-14 12:00
    And the calendar contains an event "Brunch" on 2026-10-15 from 10:00 to 11:00
    And bedtime mode is on based on my first appointment with 8 hours of sleep and 60 minutes of lead time
    When I open the day view for 2026-10-14
    Then the night band runs from 2026-10-14 23:00 to 2026-10-15 07:00

  Scenario: Without a timed appointment the fixed times apply
    Given the time is 2026-10-14 12:00
    And the calendar contains an all-day event "Holiday" on 2026-10-15
    And bedtime mode is on based on my first appointment with 8 hours of sleep and 60 minutes of lead time
    When I open the day view for 2026-10-14
    Then the night band runs from 2026-10-14 23:00 to 2026-10-15 07:00

  Scenario: The reminder shows before bedtime
    Given the time is 2026-10-14 22:30
    And bedtime mode is on with fixed times 23:00 and 07:00
    When I open the day view for 2026-10-14
    Then I see the bedtime reminder "Bedtime in 30 minutes"

  Scenario: The band shows on the Approaching track
    Given the time is 2026-10-14 21:00
    And bedtime mode is on with fixed times 23:00 and 07:00
    When I open the day view for 2026-10-14
    Then the approach bar shows a night band

  Scenario: The band shows in the Clock
    Given the time is 2026-10-14 12:00
    And bedtime mode is on with fixed times 23:00 and 07:00
    When I open the clock view for 2026-10-14
    Then the night bands of 2026-10-14 are "00:00-07:00, 23:00-24:00"

  Scenario: The band shows in the Timeline and the Strip
    Given the time is 2026-10-14 12:00
    And bedtime mode is on with fixed times 23:00 and 07:00
    When I open the timeline view
    Then the night bands of 2026-10-14 are "00:00-07:00, 23:00-24:00"
    When I open the strip view for 2026-10-14
    Then the night bands of 2026-10-14 are "00:00-07:00, 23:00-24:00"

  Scenario: Off shows nothing
    Given the time is 2026-10-14 22:30
    When I open the day view for 2026-10-14
    Then no night band is shown
    And I do not see a bedtime reminder

  @backlog
  Scenario: Different times on weekends apply to Friday and Saturday nights
    Given the time is 2026-10-16 12:00
    And bedtime mode is on with fixed times 23:00 and 07:00, and 00:00 and 09:00 on weekends
    When I open the week view for 2026-10-12
    Then the night bands of 2026-10-17 are "00:00-09:00"
    And the night bands of 2026-10-18 are "00:00-09:00, 23:00-24:00"

  @backlog
  Scenario: The reminder comes once per night
    Given the time is 2026-10-14 22:40
    And bedtime mode is on with fixed times 23:00 and 07:00
    And this device has already shown tonight's bedtime reminder
    When I open the day view for 2026-10-14
    Then I do not see a bedtime reminder

  @backlog
  Scenario: A timed task list counts as the first appointment
    Given the time is 2026-10-14 12:00
    And the calendar contains a task list "Packing" on 2026-10-15 at 07:30 for 60 minutes
    And bedtime mode is on based on my first appointment with 8 hours of sleep and 60 minutes of lead time
    When I open the day view for 2026-10-14
    Then the night band runs from 2026-10-14 22:30 to 2026-10-15 06:30
