@scrolling-widget @id:scrolling-widget
Feature: Scrolling phone widget
  A new Android home-screen widget that scrolls: it lists today and the coming days under day headers. Per widget the
  person chooses "Agenda" (one text row per entry) or "Timeline" (each day drawn as a time strip, one picture row per
  day). The week, day and clock widgets stay exactly as they are. Like them it is native, reads with the app's sign-in
  and keeps showing the app's last copy when the server cannot be reached. These scenarios are proven by the widget's
  own Android unit tests or on a device, not in the browser suite.

  Background:
    Given the calendar is empty
    And today is 2026-10-14

  @backlog
  Scenario: The Agenda lists today and the coming days under day headers
    Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    And the calendar contains an event "Yoga" on 2026-10-16 from 07:00 to 08:00
    When I look at the scrolling widget in the "Agenda" style
    Then the scrolling widget shows the day header "Wed 14 Oct" with the entry "Dentist" at "09:00"
    And the scrolling widget shows the day header "Fri 16 Oct" with the entry "Yoga" at "07:00"

  @backlog
  Scenario: The Agenda shows all-day events first and skips empty days
    Given the calendar contains an all-day event "Holiday" on 2026-10-14
    And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    When I look at the scrolling widget in the "Agenda" style
    Then the scrolling widget lists "Holiday" before "Dentist" under the day header "Wed 14 Oct"
    And the scrolling widget has no day header "Thu 15 Oct"

  @backlog
  Scenario: The Agenda shows a task list like the other widgets
    Given the calendar contains a task list "Groceries" on 2026-10-14 with items:
      | item | done |
      | Milk | yes  |
      | Eggs | no   |
      | Bread | no  |
    When I look at the scrolling widget in the "Agenda" style
    Then the scrolling widget shows the day header "Wed 14 Oct" with the task list "Groceries" and "1/3"

  @backlog
  Scenario: The Timeline draws each day as a time strip
    Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    When I look at the scrolling widget in the "Timeline" style
    Then the scrolling widget draws the day "Wed 14 Oct" as a strip with "Dentist" from 09:00 to 10:00
    And the scrolling widget draws one strip per day that has entries

  @backlog
  Scenario: Each widget keeps its own style
    Given I placed a scrolling widget and chose the "Agenda" style
    When I place a second scrolling widget and choose the "Timeline" style
    Then the first scrolling widget still shows the "Agenda" style
    And the second scrolling widget shows the "Timeline" style

  @backlog
  Scenario: The style can be changed after placing the widget
    Given I placed a scrolling widget and chose the "Agenda" style
    When I reconfigure the scrolling widget and choose the "Timeline" style
    Then the scrolling widget shows the "Timeline" style

  @backlog
  Scenario: The widget reaches 14 days ahead
    Given the calendar contains an event "Far" on 2026-10-27 from 09:00 to 10:00
    And the calendar contains an event "Too far" on 2026-10-28 from 09:00 to 10:00
    When I look at the scrolling widget in the "Agenda" style
    Then the scrolling widget shows the entry "Far" at "09:00"
    And the scrolling widget does not show the entry "Too far"

  @backlog
  Scenario: Hidden calendars and calendars whose plan is off stay off the scrolling widget
    Given "jo@example.com" has the calendar "Work" and the shared calendar "Anna"
    And the calendar "Anna" has an event "Yoga" on 2026-10-14 from 07:00 to 08:00
    And "jo@example.com" hid the calendar "Anna"
    When I look at the scrolling widget in the "Agenda" style
    Then the scrolling widget does not show the entry "Yoga"

  @backlog
  Scenario: Tapping an entry opens it in the app
    Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    When I tap the entry "Dentist" in the scrolling widget
    Then the app opens the event "Dentist"

  @backlog
  Scenario: Tapping a day header opens that day
    Given the calendar contains an event "Yoga" on 2026-10-16 from 07:00 to 08:00
    When I tap the day header "Fri 16 Oct" in the scrolling widget
    Then the app opens the day view for 2026-10-16

  @backlog
  Scenario: Tapping a day strip in the Timeline opens that day
    Given the calendar contains an event "Yoga" on 2026-10-16 from 07:00 to 08:00
    When I tap the day strip "Fri 16 Oct" in the scrolling widget
    Then the app opens the day view for 2026-10-16

  @backlog
  Scenario: Without a connection the widget shows the app's last copy
    Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    And the phone has no connection to the server
    When I look at the scrolling widget in the "Agenda" style
    Then the scrolling widget shows the entry "Dentist" at "09:00"

  @backlog
  Scenario: A change in the app shows in the widget without a manual refresh
    Given the scrolling widget shows the entry "Dentist" at "09:00"
    When the event "Dentist" moves to 11:00 in the app
    Then the scrolling widget shows the entry "Dentist" at "11:00"

  @backlog
  Scenario: A new day moves the list on
    Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    And the calendar contains an event "Yoga" on 2026-10-15 from 07:00 to 08:00
    When the date changes to 2026-10-15
    Then the scrolling widget shows no day header "Wed 14 Oct"
    And the scrolling widget shows the day header "Thu 15 Oct" with the entry "Yoga" at "07:00"

  @backlog
  Scenario: An empty list says so
    When I look at the scrolling widget in the "Agenda" style
    Then the scrolling widget says "Nothing planned"

  @backlog
  Scenario: A narrow widget shows the entry titles only
    Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    When I look at a narrow scrolling widget in the "Agenda" style
    Then the scrolling widget shows the entry "Dentist" without a time

  @backlog
  Scenario: A short widget still scrolls
    Given the calendar contains 10 events on 2026-10-14
    When I look at a short scrolling widget in the "Agenda" style
    Then the scrolling widget shows fewer entries than exist and scrolls to the others

  @backlog
  Scenario: The widget follows the dark and light theme
    Given the app's theme is dark
    When I look at the scrolling widget in the "Agenda" style
    Then the scrolling widget uses the dark theme colours

  @backlog
  Scenario: The existing widgets are unchanged
    When I look at the week widget, the day widget and the clock widget
    Then they are still drawn as one picture each and do not scroll
