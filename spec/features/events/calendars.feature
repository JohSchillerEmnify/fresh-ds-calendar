@calendars @id:all-calendars
Feature: All of a person's Google calendars
  A person sees every calendar of their Google account, their own and the ones shared with them, each in its Google
  colour. Calendars can be hidden and shown again with one tap in the filter bar; the choice is kept per person and
  holds on every device.

  Background:
    Given today is 2026-10-12
    And "jo@example.com" and "anna@example.com" may use the calendar
    And "jo@example.com" has the calendar "Jo" and the shared calendar "Family"
    And the calendar "Family" has an event "Dinner" on 2026-10-14 from 19:00 to 21:00

  Scenario: Calendars shared with me appear next to my own
    When "jo@example.com" signs in with Google
    Then they see the event "Dinner" on 2026-10-14
    And the event "Dinner" has the color of the calendar "Family"

  Scenario: Hiding a calendar with one tap
    Given "jo@example.com" is signed in
    When they hide the calendar "Family" in the filter bar
    Then they do not see the event "Dinner"

  Scenario: Hidden calendars stay hidden on every device
    Given "jo@example.com" hid the calendar "Family"
    When "jo@example.com" opens the week view for 2026-10-12 on another device
    Then they do not see the event "Dinner"

  Scenario: The Birthdays calendar is listed next to my own
    When "jo@example.com" signs in with Google
    Then the filter bar offers the calendar "Birthdays" once
