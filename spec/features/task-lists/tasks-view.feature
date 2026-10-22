@tasklists @tasks-view @id:tasks-view
Feature: The Tasks view lists every open task list
  A top-level "Tasks" view (after Day in the navigation) shows all open task lists, with and without a date.
  A task list without a date belongs to no day: it appears only here, never in the calendar views or the open
  tasks tray. Giving it a date (Today, Tomorrow or the task list dialog) puts it in the calendar on that day;
  "No date" takes it out again. Lists are grouped (Time, Category, None; default Time) and sorted (Date, Name,
  Category, Last changed, Progress; default Date); both choices are remembered per person.
  Time groups: Overdue, Today, This week (until Sunday), Later, No date.

  Background:
    Given the calendar is empty
    And today is 2026-10-12

  Scenario: A task list made in the Tasks view has no date and stays out of the calendar and the tray
    When I create the task list "Taxes" in the Tasks view
    Then the Tasks view lists "Taxes" under "No date"
    And neither the calendar on 2026-10-12 nor the open tasks tray shows the task list "Taxes"

  Scenario: Removing the date takes a list out of the calendar
    Given the calendar contains a task list "Taxes" on 2026-10-12 with items:
      | item | done |
      | Form | no   |
    When I remove the date of the task list "Taxes" in the Tasks view
    Then the Tasks view lists "Taxes" under "No date"
    And neither the calendar on 2026-10-12 nor the open tasks tray shows the task list "Taxes"

  Scenario: Lists are grouped by category
    Given the calendar contains a task list "Milk" in the category "Shopping" on 2026-10-14
    And the calendar contains a task list "Report" in the category "Work" on 2026-10-13
    When I group the Tasks view by "Category"
    Then the Tasks view groups are "Shopping, Work"
    And the Tasks view lists "Report" under "Work"

  Scenario: Lists are sorted by progress
    Given the calendar contains an undated task list "Garage" with items:
      | item  | done |
      | Sweep | no   |
      | Paint | no   |
    And the calendar contains an undated task list "Packing" with items:
      | item     | done |
      | Passport | yes  |
      | Charger  | no   |
    And the calendar contains an undated task list "Trip" with items:
      | item    | done |
      | Tickets | yes  |
      | Hotel   | no   |
      | Taxi    | no   |
    When I sort the Tasks view by "Progress"
    Then the Tasks view lists "Packing, Trip, Garage"

  Scenario: Sorting by progress can be reversed
    Given the calendar contains an undated task list "Garage" with items:
      | item  | done |
      | Sweep | no   |
      | Paint | no   |
    And the calendar contains an undated task list "Packing" with items:
      | item     | done |
      | Passport | yes  |
      | Charger  | no   |
    When I sort the Tasks view by "Progress" in reversed order
    Then the Tasks view lists "Garage, Packing"

  Scenario: The grouping choice follows the person to another device
    Given I group the Tasks view by "Category"
    When I switch to another device
    And I open the Tasks view
    Then the Tasks view is grouped by "Category"

  Scenario: Overdue lists get their own group
    Given the calendar contains a task list "Rent" on 2026-10-08 with items:
      | item | done |
      | Pay  | no   |
    And the calendar contains a task list "Groceries" on 2026-10-12 with items:
      | item | done |
      | Milk | no   |
    And the calendar contains a task list "Party" on 2026-10-25 with items:
      | item | done |
      | Cake | no   |
    When I open the Tasks view
    Then the Tasks view groups are "Overdue, Today, Later"
    And the Tasks view lists "Rent" under "Overdue"

  @backlog
  Scenario: Tomorrow puts an undated list in the calendar on the next day
    Given the calendar contains an undated task list "Taxes" with items:
      | item | done |
      | Form | no   |
    When I choose "Tomorrow" for the task list "Taxes" in the Tasks view
    Then the calendar shows the task list "Taxes" on 2026-10-13
