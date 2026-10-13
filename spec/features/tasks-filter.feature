@tasklists @tasks-filter @id:tasks-filter
Feature: One filter for the whole Tasks view
  A filter bar under the tabs applies to Open, Canvas and Archive alike: category chips (several combine with "or",
  plus "No category") and one "When" choice (All, No date, Dated, Overdue, Today, Tomorrow, This week = today through
  Sunday), combined with "and". Open and Archive hide what does not match (the Archive's search also applies); the Canvas
  dims the notes that do not match so a hand-made layout does not vanish. "Clear filters" shows while any filter is on.
  The filter is kept per person, so it follows them to every device.

  Background:
    Given the calendar is empty
    And today is 2026-10-12

  Scenario: Filtering by Shopping shows only shopping lists in Open and Archive
    Given the calendar contains a task list "Milk" in the category "Shopping" on 2026-10-14
    And the calendar contains a task list "Report" in the category "Work" on 2026-10-13
    And the calendar contains a task list "Old milk" in the category "Shopping" finished on 2026-10-09
    And the calendar contains a task list "Old report" in the category "Work" finished on 2026-10-10
    When I filter the Tasks view by the category "Shopping"
    Then the Tasks view lists "Milk"
    And the Archive lists "Old milk"
    When I clear the Tasks view filters
    Then the Archive lists "Old report, Old milk"
    And the Tasks view lists "Report, Milk"

  Scenario: The canvas dims notes that don't match
    Given the calendar contains a task list "Milk" in the category "Shopping" on 2026-10-14
    And the calendar contains a task list "Report" in the category "Work" on 2026-10-13
    When I filter the Tasks view by the category "Shopping"
    And I open the Canvas
    Then the Canvas shows the notes "Milk, Report"
    And the note "Report" is dimmed
    And the note "Milk" is not dimmed

  Scenario: Overdue shows only overdue lists
    Given the calendar contains a task list "Late" on 2026-10-10 with items:
      | item | done |
      | Pay  | no   |
    And the calendar contains a task list "Soon" on 2026-10-14 with items:
      | item | done |
      | Call | no   |
    And the calendar contains an undated task list "Someday" with items:
      | item | done |
      | Read | no   |
    When I choose "Overdue" as the Tasks view When filter
    Then the Tasks view lists "Late"

  Scenario: The filter follows me to another device
    Given the calendar contains a task list "Milk" in the category "Shopping" on 2026-10-14
    And the calendar contains a task list "Report" in the category "Work" on 2026-10-13
    When I filter the Tasks view by the category "Shopping"
    And I choose "This week" as the Tasks view When filter
    And I switch to another device
    And I open the Tasks view
    Then the Tasks view category filter "Shopping" is on
    And the Tasks view When filter is "This week"
    And the Tasks view lists "Milk"
