@tasklists @tasks-calendar @id:tasklists-own-calendar
Feature: Task lists live in their own calendar
  Task lists are kept out of the person's main Google calendar (owner, 2026-10-13: "I don't want to pollute
  things"). Each person gets one calendar "Calendar app: tasks" in their Google account, created by the app when it is
  first needed and switched off in Google's own calendar list, so Google shows only real appointments. The app has no
  switch to show it in Google (owner, 2026-11-12: it never worked, so it is removed); a calendar a person had already
  shown in Google stays as it is. Everything else works like for any other calendar (owner, 2026-11-12: "fundamentally
  it should be the same as the other cals"): in Settings › Calendars its row has the colour dot and the plan line, and
  its page (Task lists calendar) has the same rows as a calendar's page: Show calendar, Color, Plan and Default
  reminders. Show calendar and Plan are the app's own choice (nothing is written to Google): while the calendar is off
  its task lists disappear from the calendar views like any calendar's events do, on every device and in the widgets;
  the Tasks view keeps listing every open task list. Color is written to Google as the person's calendar list colour;
  task lists that follow the calendar colour (no category, or task categories off) are drawn in it. Default reminders
  are set only here; Settings › Reminders offers no second place for them (owner, 2026-11-12: it was left over there). The calendar is not a filter chip: it is chosen here only.

  Background:
    Given the calendar is empty
    And today is 2026-10-12

  Scenario: A new task list goes into the hidden tasks calendar, not the main calendar
    When I create the task list "Groceries" on 2026-10-14 with the item "Milk"
    Then Google has a hidden calendar "Calendar app: tasks" with the event "Groceries"
    And the main calendar has no event "Groceries"

  Scenario: The tasks calendar is made only once
    Given Google has a hidden calendar "Calendar app: tasks"
    When I create the task list "Groceries" on 2026-10-14 with the item "Milk"
    Then Google has exactly one calendar "Calendar app: tasks"

  Scenario: The tasks calendar is not offered as a calendar to filter
    Given Google has a hidden calendar "Calendar app: tasks"
    When I open the week view for 2026-10-12
    And I show the filters
    Then the filter bar does not offer the calendar "Calendar app: tasks"

  Scenario: The task lists calendar's settings page offers the calendar colours
    Given Google has a hidden calendar "Calendar app: tasks"
    When I open the settings
    And I open the settings group "Calendars"
    And I open the calendar "Task lists calendar" in the settings
    Then the settings page shows the setting "Color"
    And the calendar's settings page offers 24 palette colours

  Scenario: Picking a colour recolours the task lists and goes to Google
    Given the calendar contains a task list "Groceries" on 2026-10-14 with items:
      | item | done |
      | Milk | no   |
    And task categories are off
    When I open the settings
    And I open the settings group "Calendars"
    And I open the calendar "Task lists calendar" in the settings
    And I choose the palette colour 8 on the calendar's settings page
    Then the palette colour 8 is chosen on the calendar's settings page
    And Google lists the calendar "Calendar app: tasks" with the palette colour 8
    When I leave the settings
    And I open the day view for 2026-10-14
    Then the task list "Groceries" has the color "#16a765"

  Scenario: The calendars list shows the task lists calendar like the others
    Given Google has a hidden calendar "Calendar app: tasks"
    And task categories are off
    When I open the settings
    And I open the settings group "Calendars"
    And I open the calendar "Task lists calendar" in the settings
    And I choose the palette colour 8 on the calendar's settings page
    And I open the settings group "Calendars"
    Then the calendar "Task lists calendar" in the settings shows the colour "#16a765"
    And the settings show the plan "Always on" for the calendar "Task lists calendar"

  Scenario: The task lists calendar's page offers the rows of any calendar's page
    Given Google has a hidden calendar "Calendar app: tasks"
    When I open the settings
    And I open the settings group "Calendars"
    And I open the calendar "Task lists calendar" in the settings
    Then the settings page shows the setting "Show this calendar"
    And the settings page shows the setting "Color"
    And the settings page shows the setting "Plan"
    And the settings page shows the setting "Default reminders"

  Scenario: Switching the task lists calendar off hides its task lists in the app and back on shows them
    Given the calendar contains a task list "Groceries" on 2026-10-14 with items:
      | item | done |
      | Milk | no   |
    When I open the settings
    And I open the settings group "Calendars"
    And I open the calendar "Task lists calendar" in the settings
    And I switch the calendar off in its settings page
    And I leave the settings
    And I open the day view for 2026-10-14
    Then I do not see the task list "Groceries"
    When I open the settings
    And I open the settings group "Calendars"
    Then the settings show the plan "Hidden" for the calendar "Task lists calendar"
    When I open the calendar "Task lists calendar" in the settings
    And I switch the calendar on in its settings page
    And I leave the settings
    And I open the day view for 2026-10-14
    Then I see the task list "Groceries" on 2026-10-14

  Scenario: Switching the task lists calendar off changes nothing in Google
    Given Google has a hidden calendar "Calendar app: tasks"
    When I open the settings
    And I open the settings group "Calendars"
    And I open the calendar "Task lists calendar" in the settings
    And I switch the calendar off in its settings page
    Then Google still has the calendar "Calendar app: tasks" switched off in its list

  Scenario: The task lists calendar's plan switches its task lists off
    Given the calendar contains a task list "Groceries" on 2026-10-12 with items:
      | item | done |
      | Milk | no   |
    And the time is 2026-10-12 10:00
    When I open the settings
    And I open the plan of the calendar "Task lists calendar" in the settings
    And I choose "Off at set times" in the calendar sheet
    And I set the off time from "Mon" 08:00 to "Mon" 20:00 in the calendar sheet
    And I choose "Done" in the calendar sheet
    And I open the day view for 2026-10-12
    Then I do not see the task list "Groceries"

  Scenario: The task lists calendar's default reminders are edited on its page, the one place for them
    Given Google has a hidden calendar "Calendar app: tasks"
    When I open the settings
    And I open the settings group "Calendars"
    And I open the calendar "Task lists calendar" in the settings
    And I add the default reminder "15 min" for the calendar "Task lists calendar"
    Then the calendar "Calendar app: tasks" has the default reminders "15" in Google
    When I open the reminder settings
    Then the settings page does not show the setting "Default reminders of task lists"

  Scenario: There is no switch to show the task lists calendar in Google
    When I open the settings
    And I open the settings group "Calendars"
    And I open the calendar "Task lists calendar" in the settings
    Then the settings page does not show the setting "Show the task lists calendar in Google"
    When I go back in the settings
    And I go back in the settings
    And I search the settings for "Show the task lists calendar in Google"
    Then the settings search says nothing matches "Show the task lists calendar in Google"

  @visual @mobile
  Scenario Outline: The task lists calendar's settings page looks right in light and dark
    Given the device prefers a <scheme> color scheme
    And Google has a hidden calendar "Calendar app: tasks"
    When I open the settings
    And I open the settings group "Calendars"
    And I open the calendar "Task lists calendar" in the settings
    Then no text in the "settings page" is clipped
    And the "settings page" still looks like "settings-tasks-calendar-<scheme>"

    Examples:
      | scheme |
      | light  |
      | dark   |
