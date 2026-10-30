@tasklists @tasks-toolbar @id:tasks-toolbar
Feature: The Tasks view's list tools float next to the + button
  Owner decision 2026-10-30 (design E, ADR 0032). In the Tasks view the list tools (filter, sort, fold) sit in a
  floating toolbar next to the + button instead of in the top bar. The tools are icon-only with accessible labels and
  tonal; the + button is the one filled primary. The toolbar slides away with the bottom bar while scrolling down and
  returns on scroll up.
  The scenarios without a viewport tag run on the phone only (`@mobile`).

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And the calendar contains a task list "Groceries" on 2026-10-12 with items:
      | item | done |
      | Milk | no   |

  @mobile
  Scenario: The list tools float beside the + button
    When I open the path "/tasks"
    Then the floating toolbar offers "Filter, Sort, Fold"
    And the floating toolbar is beside the create button
    And the top bar has no filter button

  @mobile
  Scenario: Only the + button is filled
    When I open the path "/tasks"
    Then the surface has one filled "create button"
    And the tools of the floating toolbar are tonal icon buttons with labels

  @mobile
  Scenario: The sort tool changes the order of the lists
    Given the calendar contains a task list "Taxes" on 2026-10-14 with items:
      | item | done |
      | Form | no   |
    When I open the path "/tasks"
    And I press "Sort" in the floating toolbar
    And I choose "Name" as the sort order
    Then the Tasks view lists "Groceries, Taxes" in that order

  @mobile
  Scenario: The fold tool collapses every list
    When I open the path "/tasks"
    And I press "Fold" in the floating toolbar
    Then the card of the task list "Groceries" in the Tasks view is collapsed

  @mobile
  Scenario: The toolbar hides while scrolling down and returns on scroll up
    Given the calendar contains a task list "Long list" on 2026-10-14 with 20 generated items
    When I open the path "/tasks"
    And I scroll the calendar down by 300 pixels
    Then the floating toolbar is hidden
    When I scroll the calendar up by 60 pixels
    Then the floating toolbar is shown
