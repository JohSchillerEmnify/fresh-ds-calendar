@tasklists @tasks-calendar @id:tasklists-own-calendar
Feature: Task lists live in their own calendar
  Task lists are kept out of the person's main Google calendar (owner, 2026-10-13: "I don't want to pollute
  things"). Each person gets one calendar "Calendar app: tasks" in their Google account, created by the app when it is
  first needed and switched off in Google's own calendar list, so Google shows only real appointments unless the
  person switches it on.

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
