@tasklists @collapse @tasks-view @id:tasklists-collapse
Feature: Task list cards are collapsible and compact
  A task list card (the tray, the Tasks view and the Canvas notes) has a chevron in its header. Collapsed, the card
  shows only its head (category colour, title, progress such as 2/5, and the "From" tag of an overdue list), no items.
  The choice is remembered per list on this device. The Tasks view has one "Collapse all / Expand all" toggle.
  Add item is the only button in the card's footer (Edit and Delete are in the overflow menu); its field shows only while adding.

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And the calendar contains an undated task list "Taxes" with items:
      | item  | done |
      | Form  | yes  |
      | Stamp | no   |
    And the calendar contains an undated task list "Garage" with items:
      | item  | done |
      | Sweep | no   |

  Scenario: A task list card can be collapsed to its title and progress
    When I open the Tasks view
    And I collapse the card of the task list "Taxes" in the Tasks view
    Then the card of the task list "Taxes" in the Tasks view is collapsed
    And the card of the task list "Taxes" in the Tasks view shows no items
    And the card of the task list "Taxes" in the Tasks view shows the done count "1/2"
    When I expand the card of the task list "Taxes" in the Tasks view
    Then the card of the task list "Taxes" in the Tasks view is expanded
    And the card of the task list "Taxes" in the Tasks view shows the items "Form, Stamp"

  Scenario: The collapsed state is remembered
    When I open the Tasks view
    And I collapse the card of the task list "Taxes" in the Tasks view
    And I reload the page
    And I open the Tasks view
    Then the card of the task list "Taxes" in the Tasks view is collapsed
    And the card of the task list "Garage" in the Tasks view is expanded

  Scenario: Collapse all in the Tasks view
    When I open the Tasks view
    And I collapse all task lists in the Tasks view
    Then the card of the task list "Taxes" in the Tasks view is collapsed
    And the card of the task list "Garage" in the Tasks view is collapsed
    When I expand all task lists in the Tasks view
    Then the card of the task list "Taxes" in the Tasks view is expanded
    And the card of the task list "Garage" in the Tasks view is expanded

  Scenario: Add item is the only button in the card footer
    When I open the Tasks view
    Then the Add item button of the task list "Taxes" in the Tasks view is the only button of the card footer
    And the add field of the task list "Taxes" in the Tasks view is hidden
    When I tap Add item of the task list "Taxes" in the Tasks view
    Then the add field of the task list "Taxes" in the Tasks view is shown
