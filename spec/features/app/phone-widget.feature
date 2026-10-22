@phone-widget @id:phone-widget
Feature: Phone widgets
  The Android app brings home-screen widgets: the week like the app's week view in miniature, today like the day view,
  and today as the 24-hour clock. They read the week themselves with the app's sign-in, so they stay current while the
  app is closed. The widgets are native Android: these scenarios are proven by the widget's own tests or on a device,
  not in the browser suite.

  Background:
    Given the calendar is empty
    And today is 2026-10-14

  @backlog
  Scenario: Hidden calendars stay off the widget
    Given "jo@example.com" has the calendar "Work" and the shared calendar "Anna"
    And the calendar "Anna" has an event "Yoga" on 2026-10-14 from 07:00 to 08:00
    And "jo@example.com" hid the calendar "Anna"
    When the phone widget refreshes
    Then the phone widget does not show the event "Yoga"

  @backlog
  Scenario: An older copy from the app does not turn the widget back
    Given the phone widget shows the event "Dentist" on 2026-10-14 at 11:00
    When the app hands the widget an older copy of the week with "Dentist" at 09:00
    Then the phone widget shows the event "Dentist" on 2026-10-14 at 11:00

  @backlog
  Scenario: A sync without changes does not make the widget flash
    Given the phone widget shows the event "Dentist" on 2026-10-14 at 11:00
    When the app syncs
    Then the phone widget is not redrawn

  @backlog
  Scenario: The day widget shows today
    Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    When I look at the day widget
    Then the day widget shows the event "Dentist" from 09:00 to 10:00

  @backlog
  Scenario: The clock widget says what is going on now
    Given the time is 2026-10-14 09:20
    And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    When I look at the clock widget
    Then the clock widget says "Dentist · 40 min left"
