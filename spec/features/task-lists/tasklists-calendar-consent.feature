@tasklists @tasks-calendar @id:tasklists-calendar-consent
Feature: Task lists are turned on once, after the person agrees
  Task lists are kept in an extra calendar that the app adds to the person's Google account (see
  tasklists-own-calendar). It is added only after the person agrees: right after opening the web app or the Android app
  the first time and signing in, a sheet "Turn on task lists?" explains it (the Android app shows the same sheet, it is
  the same web code). "Turn on" adds the calendar once; "Not now" adds nothing and keeps task lists off until the person
  turns them on in Settings > Task lists. Someone who already has the calendar (a new person only is asked, owner
  decision on issue 167) keeps task lists and is never asked. Reading the calendars, the calendar views or the change
  feed never adds the calendar; only the confirmation does. While task lists are off there is no task list option in the
  create menu, no Tasks view in the view switcher, no open tasks tray, and no task list is shown anywhere, in the app
  and in the widgets. The app cannot hide the calendar in Google Calendar for the person (it asks Google's list to leave
  it out, which Google's own apps may ignore), so the sheet only says that it can be hidden or deleted there, and that
  deleting it deletes the task lists. The answer is kept on the device, so it also holds offline.
  Texts: owner decision on issue 167 (the wording agreed there).

  Background:
    Given the calendar is empty
    And today is 2026-10-12

  @backlog
  Scenario: A new person is asked right after signing in, and nothing is added to Google yet
    Given "anna@example.com" may use the calendar
    And task lists have not been turned on or off yet
    When "anna@example.com" signs in with Google
    Then I see the task lists question
    And Google has no calendar "Calendar app: tasks"

  @backlog
  Scenario: The question explains the extra calendar
    Given task lists have not been turned on or off yet
    When I open the week view for 2026-10-12
    Then the task lists question says "Turn on task lists?"
    And the task lists question says "Task lists are kept in an extra calendar that the app adds to your Google account. It holds only your task lists. You can hide or delete it in Google Calendar (deleting it deletes your task lists)."
    And the task lists question says "Calendar app: tasks"
    And the task lists question says "You can turn task lists on later in Settings."
    And the task lists question offers "Not now" and "Turn on"

  @backlog
  Scenario: The question is in German for a German browser
    Given the browser language is "de-DE"
    And task lists have not been turned on or off yet
    When I open the week view for 2026-10-12
    Then the task lists question says "Aufgabenlisten einschalten?"
    And the task lists question says "Aufgabenlisten liegen in einem eigenen Kalender, den die App in deinem Google-Konto anlegt. Er enthält nur deine Aufgabenlisten. Du kannst ihn in Google Kalender ausblenden oder löschen (Löschen löscht auch deine Aufgabenlisten)."
    And the task lists question says "Du kannst sie später in den Einstellungen einschalten."
    And the task lists question offers "Nicht jetzt" and "Einschalten"

  @backlog
  Scenario: "Turn on" adds the calendar once and task lists work
    Given task lists have not been turned on or off yet
    When I open the week view for 2026-10-12
    And I choose "Turn on" in the task lists question
    Then I do not see the task lists question
    And Google has exactly one calendar "Calendar app: tasks"
    When I create the task list "Groceries" on 2026-10-14 with the item "Milk"
    Then Google has a hidden calendar "Calendar app: tasks" with the event "Groceries"
    And Google has exactly one calendar "Calendar app: tasks"

  @backlog
  Scenario: "Not now" adds nothing, turns task lists off and the question does not come back
    Given task lists have not been turned on or off yet
    When I open the week view for 2026-10-12
    And I choose "Not now" in the task lists question
    Then I do not see the task lists question
    And Google has no calendar "Calendar app: tasks"
    And the create menu does not offer task lists
    And the view switcher does not offer "Tasks"
    And the open tasks tray is not on the screen
    When I reload the page
    Then I do not see the task lists question
    And Google has no calendar "Calendar app: tasks"

  @backlog
  Scenario: Task lists that exist are not shown while task lists are off
    Given the calendar contains a task list "Groceries" on 2026-10-14 with items:
      | item | done |
      | Milk | no   |
    And task lists have been turned off
    When I open the week view for 2026-10-12
    Then I do not see the task list "Groceries"
    And I do not see the task lists question

  @backlog
  Scenario: Settings > Task lists turns them on later with the same question
    Given task lists have not been turned on or off yet
    When I open the week view for 2026-10-12
    And I choose "Not now" in the task lists question
    And I open the settings
    And I open the settings group "Task lists"
    Then the settings page shows the setting "Task lists"
    When I tap the switch "Task lists" in the settings
    Then I see the task lists question
    When I choose "Turn on" in the task lists question
    Then I do not see the task lists question
    And Google has exactly one calendar "Calendar app: tasks"
    When I leave the settings
    Then the create menu offers task lists
    And the view switcher offers "Tasks"

  @backlog
  Scenario: Someone who already has the calendar keeps task lists and is never asked
    Given Google has a hidden calendar "Calendar app: tasks"
    And task lists have not been turned on or off yet
    When I open the week view for 2026-10-12
    Then I do not see the task lists question
    And the create menu offers task lists
    And the view switcher offers "Tasks"
    And Google has exactly one calendar "Calendar app: tasks"

  @backlog
  Scenario: The answer holds offline
    Given task lists have not been turned on or off yet
    When I have seen the week view for 2026-10-12
    And I choose "Not now" in the task lists question
    And the app has synced this device
    And the network connection is lost
    And I open the app again
    Then I do not see the task lists question
    And the create menu does not offer task lists

  # unit: server/test/tasksCalendar.test.ts:reads never create the calendar: the calendar list, items, change feed and every task list read leave Google alone
  @unit
  Scenario: Reading never adds the calendar
    Given task lists have not been turned on or off yet
    When the calendar list, the items of a week, the change feed and every task list list are read
    Then Google has no calendar "Calendar app: tasks"

  # unit: server/test/tasksCalendar.test.ts:a write while off is refused and creates nothing
  @unit
  Scenario: Saving a task list while task lists are off is refused
    Given task lists have not been turned on or off yet
    When a task list is saved
    Then it is refused and Google has no calendar "Calendar app: tasks"

