@android-app @id:android-app
Feature: The Android app
  The Android app shows the calendar's web app; which server it loads is configuration, not behaviour. Inside the app, reminders reach the lock screen as phone notifications, and a morning overview sums up the day.
  The app is native Android: these scenarios are proven by the app's own tests or on a device, not in the browser suite.

  Background:
    Given the calendar is empty
    And the time is 2026-10-12 20:00

  @backlog
  Scenario: A reminder is planned as a phone notification
    Given the app runs inside the Android app
    And the calendar contains an event "Dentist" on 2026-10-13 from 11:00 to 11:30
    And the event "Dentist" has its own reminders "30" in Google
    When I open the week view for 2026-10-12
    Then a notification "Dentist" saying "11:00 – 11:30" is planned for 2026-10-13 10:30

  @backlog
  Scenario: A reminder notification counts down to the start, then shows the times until the end
    It may be read long after it came: the phone keeps the time left right, the text gives the times, never "in 30 min".
    Given the app runs inside the Android app
    And the calendar contains an event "Dentist" on 2026-10-13 from 11:00 to 11:30
    And the event "Dentist" has its own reminders "30" in Google
    When I open the week view for 2026-10-12
    Then the notification "Dentist" planned for 2026-10-13 10:30 counts down to 2026-10-13 11:00
    And from 2026-10-13 11:00 the notification "Dentist" shows no countdown and goes away at 2026-10-13 11:30

  @backlog
  Scenario: The bedtime notification gives the bedtime, counts down to it and goes away at wake-up
    Given the app runs inside the Android app
    And bedtime mode is on with fixed times 23:00 and 07:00
    When I open the day view for 2026-10-12
    Then a notification "Bedtime at 23:00" is planned for 2026-10-12 22:30
    And the notification "Bedtime at 23:00" planned for 2026-10-12 22:30 counts down to 2026-10-12 23:00
    And from 2026-10-12 23:00 the notification "Bedtime at 23:00" shows no countdown and goes away at 2026-10-13 07:00

  @backlog
  Scenario Outline: Each kind of notification has its own status bar icon
    Only the bedtime notification shows the moon.
    Given the app runs inside the Android app
    When a "<kind>" notification shows
    Then its status bar icon is the "<icon>"

    Examples:
      | kind                | icon          |
      | event reminder      | calendar page |
      | task list reminder  | checklist     |
      | morning overview    | sunrise       |
      | bedtime reminder    | moon          |

  @backlog
  Scenario: The morning overview sums up the next day
    Given the app runs inside the Android app
    And the morning overview is on at 07:30
    And the calendar contains an event "Dentist" on 2026-10-13 from 10:00 to 11:00
    When I open the week view for 2026-10-12
    Then a notification "Your day" saying "1 appointment · no lists · first: Dentist 10:00" is planned for 2026-10-13 07:30
