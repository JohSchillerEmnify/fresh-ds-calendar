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
    Then a notification "Dentist starts in 30 min" is planned for 2026-10-13 10:30

  @backlog
  Scenario: The morning overview sums up the next day
    Given the app runs inside the Android app
    And the morning overview is on at 07:30
    And the calendar contains an event "Dentist" on 2026-10-13 from 10:00 to 11:00
    When I open the week view for 2026-10-12
    Then a notification "Your day" saying "1 appointment · no lists · first: Dentist 10:00" is planned for 2026-10-13 07:30
