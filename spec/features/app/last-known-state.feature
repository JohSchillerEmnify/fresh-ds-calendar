@offline @last-known-state @id:last-known-state
Feature: The app opens with the last known state
  The app keeps what it last showed on this device and shows it at once; fresh data replaces it as soon as the server
  answers (owner, 2026-10-23: "the app sometimes takes quite long to load things if internet is bad"). Kept are the
  calendar days seen within about four weeks of today (older ones are dropped), the task lists on them, the settings,
  the preferences and the task list templates, separately for each signed-in person. While the shown calendar is not fresh, a small note says
  when it was last updated. Without a connection nothing can be changed: saving still fails with the sync banner.
  Signing out removes what the device kept.

  Background:
    Given the calendar is empty
    And the time is 2026-10-12 08:12

  Scenario: Without a connection the app shows the last known calendar
    Given the calendar contains an event "Dentist" on 2026-10-13 from 10:00 to 11:00
    And I have seen the week view for 2026-10-12
    And the network connection is lost
    When I open the app again
    Then the event "Dentist" is positioned on 2026-10-13 from 10:00 to 11:00
    And I see the sync error banner
    And I am told the calendar was last updated at "08:12"

  Scenario: On a slow connection the last known state shows at once and is then updated
    Given the calendar contains an event "Dentist" on 2026-10-13 from 10:00 to 11:00
    And I have seen the week view for 2026-10-12
    And Google moves the event "Dentist" to 2026-10-13 from 11:00 to 12:00
    And the server answers only after 10 seconds
    When I open the app again
    Then the event "Dentist" is positioned on 2026-10-13 from 10:00 to 11:00
    And I am told the calendar was last updated at "08:12"
    When the server has answered
    Then the event "Dentist" is positioned on 2026-10-13 from 11:00 to 12:00
    And I am not told when the calendar was last updated

  Scenario: Task lists and my settings are kept too
    Given the calendar contains a task list "Groceries" on 2026-10-12 with items:
      | item | done |
      | Milk | yes  |
      | Eggs | no   |
    And I open the day view for 2026-10-12
    And I open the settings
    And I choose "Deutsch" as the language
    And I choose the theme mode "Dark"
    And I have seen the day view for 2026-10-12
    And the network connection is lost
    When I open the app again
    And I expand the task list "Groceries"
    Then the item "Milk" is ticked
    And the app uses the dark theme
    And the page language is "de"

  Scenario: Days I have never seen stay empty without a connection
    Given the calendar contains an event "Dentist" on 2026-10-13 from 10:00 to 11:00
    And the calendar contains an event "Haircut" on 2026-10-21 from 15:00 to 16:00
    And I have seen the week view for 2026-10-12
    And the network connection is lost
    When I open the app again
    And I go to the next period
    Then I do not see the event "Haircut"
    And I see the sync error banner

  @signin
  Scenario: Signing out removes the stored calendar from the device
    Given "jo@example.com" and "anna@example.com" may use the calendar
    And "jo@example.com" has an event "Dentist" on 2026-10-13 from 10:00 to 11:00
    And "jo@example.com" is signed in
    And I have seen the week view for 2026-10-12
    And this device keeps a last known calendar
    When they sign out in the settings
    Then they see the sign-in page
    And this device keeps no last known calendar

  @signin @templates
  Scenario: Someone else signing in on this device does not get my templates
    Given "jo@example.com" and "anna@example.com" may use the calendar
    And "jo@example.com" is signed in
    And I have the template "Packing" with the items "Passport"
    And I have seen the week view for 2026-10-12
    When they sign out in the settings
    And "anna@example.com" signs in with Google
    And I have seen the week view for 2026-10-12
    And the network connection is lost
    And I open the app again
    And I open the templates in the settings
    Then the templates page says "No templates yet. Save a task list as a template to reuse it."
