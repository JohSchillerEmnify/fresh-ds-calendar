@adhd
Feature: ADHD support: estimates, transition warnings, next task, calm mode
  Evidence-based helpers (see docs/ADHD-RESEARCH.md): duration estimates make time visible,
  transition warnings ease switching, the Now card names one small next task, and calm mode
  reduces visual clutter. Wording is always supportive.

  Background:
    Given the calendar is empty

  # --- Duration estimates ---------------------------------------------------

  Scenario: A task list with an estimate shows it and occupies that time on the timeline
    Given today is 2026-10-12
    When I open the week view for 2026-10-12
    And I start creating a task list
    And I fill in the task list form with:
      | title    | Tidy desk  |
      | date     | 2026-10-14 |
      | time     | 18:00      |
      | estimate | 45         |
      | items    | Papers     |
    And I save the task list
    Then the task list "Tidy desk" shows the estimate "~45 min"
    And the Google event for the task list "Tidy desk" is a timed event on 2026-10-14 from 18:00 to 18:45
    And the Google event for the task list "Tidy desk" has the private extended property "estimate" set to "45"

  Scenario: Long estimates are shown in hours and minutes
    Given today is 2026-10-12
    When I open the day view for 2026-10-14
    And I start creating a task list
    And I fill in the task list form with:
      | title    | Taxes      |
      | date     | 2026-10-14 |
      | estimate | 90         |
    And I save the task list
    Then the task list "Taxes" shows the estimate "~1 h 30 min"

  # --- Transition warnings --------------------------------------------------

  Scenario: A gentle warning appears before the next event starts
    Given the calendar contains an event "Dentist" on 2026-10-12 from 10:40 to 11:30
    And the time is 2026-10-12 10:25 and the clock is running
    When I open the week view for 2026-10-12
    Then I do not see a transition warning
    When 5 minutes pass
    Then I see the transition warning "Dentist starts in 10 min"
    When I dismiss the transition warning
    Then I do not see a transition warning
    When 2 minutes pass
    Then I do not see a transition warning

  Scenario: The warning time can be changed or switched off
    Given the calendar contains an event "Dentist" on 2026-10-12 from 10:40 to 11:30
    And the time is 2026-10-12 10:25 and the clock is running
    When I open the path "/settings"
    And I choose "Off" as the transition warning time
    And I open the day view for 2026-10-12
    And 6 minutes pass
    Then I do not see a transition warning

  # --- Calm mode ------------------------------------------------------------

  Scenario: Calm mode reduces clutter
    Given today is 2026-10-12
    And the calendar contains a task list "Groceries" in the category "Shopping" with the tags "weekend" on 2026-10-14
    When I open the path "/settings"
    And I turn on calm mode
    Then calm mode is active
    When I open the week view for 2026-10-12
    Then the collapsed task list "Groceries" does not list its items
    And the task list "Groceries" shows the done count "0/0"
    When I reload the page
    Then calm mode is active

  # --- Recurring task lists (optional) --------------------------------------

  @optional
  Scenario: A weekly task list repeats and each week is ticked separately
    Given today is 2026-10-12
    When I open the week view for 2026-10-12
    And I start creating a task list
    And I fill in the task list form with:
      | title  | Clean bathroom |
      | date   | 2026-10-14     |
      | repeat | Weekly         |
      | items  | Sink; Floor    |
    And I save the task list
    And I open the day view for 2026-10-14
    And I expand the task list "Clean bathroom"
    And I tick the item "Sink"
    And I open the week view for 2026-10-19
    Then I see the task list "Clean bathroom" on 2026-10-21
    And the task list "Clean bathroom" shows the done count "0/2"
