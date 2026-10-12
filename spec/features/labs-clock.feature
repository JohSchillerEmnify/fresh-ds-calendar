@labs @clock @id:labs-clock
Feature: Labs: experimental views and the 24-hour clock
  Experimental views are tried out behind a Labs switch in the settings: when it is on, the view switcher offers them,
  marked as experimental; when it is off, nothing changes. The clock view shows one day as a 24-hour circle: events are
  arcs from their start to their end, task lists with a time are arcs as long as their estimate (30 minutes without
  one) and named with their done count, task lists without a time are listed in the middle, and a hand points at the
  current time. The clock is as large as the space allows.

  Background:
    Given the calendar is empty
    And today is 2026-10-14
    And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00

  Scenario: Experimental views appear only with Labs on
    When I open the week view for 2026-10-12
    And I turn on experimental views in the settings
    Then the view switcher offers "Clock", "Timeline" and "Strip" marked as experimental

  Scenario: The clock shows the day as a 24-hour circle
    Given the time is 2026-10-14 09:30
    When I open the clock view for 2026-10-14
    Then the event "Dentist" is an arc from 09:00 to 10:00
    And the clock hand points at 09:30

  Scenario: The clock names each event
    When I open the clock view for 2026-10-14
    Then the arc of "Dentist" is labelled "Dentist"

  Scenario: Task lists with a time are named arcs as long as they take
    Given the calendar contains a task list "Laundry" on 2026-10-14 at 18:00 for 90 minutes with items:
      | item | done |
      | Wash | yes  |
      | Fold | no   |
    When I open the clock view for 2026-10-14
    Then the task list "Laundry" is an arc from 18:00 to 19:30
    And the arc of "Laundry" is labelled "Laundry 1/2"

  Scenario: Task lists without a time are listed in the middle
    Given the calendar contains a task list "Groceries" on 2026-10-14 with items:
      | item | done |
      | Milk | no   |
    When I open the clock view for 2026-10-14
    Then the middle of the clock lists "Groceries 0/1"

  Scenario: The clock uses the space it is given
    When I open the clock view for 2026-10-14
    Then the clock fills the available space
