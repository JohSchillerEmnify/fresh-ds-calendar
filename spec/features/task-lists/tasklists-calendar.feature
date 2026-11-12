@tasklists @tasks-calendar @id:tasklists-own-calendar
Feature: Task lists live in their own calendar
  Task lists are kept out of the person's main Google calendar (owner, 2026-10-13: "I don't want to pollute
  things"). Each person gets one calendar "Calendar app: tasks" in their Google account, created by the app when it is
  first needed and switched off in Google's own calendar list, so Google shows only real appointments. The app has no
  switch to show it in Google (owner, 2026-11-12: it never worked, so it is removed); a calendar a person had already
  shown in Google stays as it is. Its colour is set like any calendar's, on its settings page (Settings › Calendars ›
  Task lists calendar): the same Color row, written to Google as the person's calendar list colour; task lists that
  follow the calendar colour (no category, or task categories off) are drawn in it.

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

  Scenario: The calendars list shows the task lists calendar's colour
    Given task categories are off
    When I open the settings
    And I open the settings group "Calendars"
    And I open the calendar "Task lists calendar" in the settings
    And I choose the palette colour 8 on the calendar's settings page
    And I open the settings group "Calendars"
    Then the calendar "Task lists calendar" in the settings shows the colour "#16a765"

  Scenario: There is no switch to show the task lists calendar in Google
    When I open the settings
    And I open the settings group "Calendars"
    And I open the calendar "Task lists calendar" in the settings
    Then the settings page does not show the setting "Show the task lists calendar in Google"
    When I go back in the settings
    And I go back in the settings
    And I search the settings for "Show the task lists calendar in Google"
    Then the settings search says nothing matches "Show the task lists calendar in Google"

  @visual
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
