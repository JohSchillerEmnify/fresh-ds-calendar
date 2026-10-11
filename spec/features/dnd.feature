@dnd
Feature: Drag and drop to reschedule
  Events and task lists can be dragged to another time and day (week and day views, snapped to
  15-minute slots) or to another day (month view). Touch: long-press to pick up (with a haptic tick where
  the device supports it); mouse: press and drag. The card lifts, follows with a spring and settles on drop.
  The move is saved to Google at once; if saving fails the card springs back and the error banner shows.
  The edit dialog stays available as an accessible alternative.

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00

  Scenario: Drag an event to another day and time in the week view
    When I open the week view for 2026-10-12
    And I drag the event "Dentist" to 2026-10-16 at 14:00
    Then I see the event "Dentist" on "Friday"
    And the event "Dentist" is positioned from 14:00 to 15:00
    And Google contains an event "Dentist" on 2026-10-16 from 14:00 to 15:00
    And a "drop" effect appears and is removed within 1000 ms

  Scenario: Moves snap to 15-minute slots and keep the duration
    When I open the day view for 2026-10-14
    And I drag the event "Dentist" down by 37 minutes
    Then the event "Dentist" is positioned from 09:30 to 10:30
    And Google contains an event "Dentist" on 2026-10-14 from 09:30 to 10:30

  Scenario: Drag an event to another day in the month view keeps its time
    When I open the month view for 2026-10
    And I drag the event "Dentist" to 2026-10-21
    Then I see the event "Dentist" on 2026-10-21
    And I do not see the event "Dentist" on 2026-10-14
    And Google contains an event "Dentist" on 2026-10-21 from 09:00 to 10:00

  Scenario: Drag an all-day event to another day
    Given the calendar contains an all-day event "Trip" from 2026-10-14 to 2026-10-15
    When I open the week view for 2026-10-12
    And I drag the event "Trip" to 2026-10-16
    Then I see the all-day event "Trip" on 2026-10-16
    And I see the all-day event "Trip" on 2026-10-17
    And Google contains an all-day event "Trip" from 2026-10-16 to 2026-10-17

  Scenario: Drag a task list to another day
    Given the calendar contains a task list "Groceries" on 2026-10-14 with items:
      | item | done |
      | Milk | no   |
    When I open the week view for 2026-10-12
    And I drag the task list "Groceries" to 2026-10-15
    Then I see the task list "Groceries" on 2026-10-15
    And the Google event for the task list "Groceries" is an all-day event on 2026-10-15

  Scenario: Drag a timed task list to another time
    Given the calendar contains a task list "Packing" on 2026-10-15 at 18:00 with items:
      | item     | done |
      | Passport | no   |
    When I open the week view for 2026-10-12
    And I drag the task list "Packing" to 2026-10-16 at 08:15
    Then the task list "Packing" is positioned at 08:15
    And the Google event for the task list "Packing" is a timed event on 2026-10-16 from 08:15 to 08:45

  Scenario: A failed save springs the card back
    When I open the week view for 2026-10-12
    And Google becomes unavailable
    And I drag the event "Dentist" to 2026-10-16 at 14:00
    Then I see the sync error banner
    And I see the event "Dentist" on 2026-10-14
    And the event "Dentist" is positioned from 09:00 to 10:00

  Scenario: Picking up lifts the card and releasing without moving puts it back
    When I open the day view for 2026-10-14
    And I pick up the event "Dentist"
    Then the event "Dentist" is lifted
    When I release the event without moving it
    Then the event "Dentist" is not lifted
    And the event "Dentist" is positioned from 09:00 to 10:00
    And Google contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00

  @mobile
  Scenario: Long-press on a phone picks up with a haptic tick, a short tap still opens
    Given I am using a phone
    When I open the day view for 2026-10-14
    And I pick up the event "Dentist"
    Then the event "Dentist" is lifted
    And a haptic tick was requested
    When I release the event without moving it
    And I open the event "Dentist"
    Then the event dialog is open

  @mobile
  Scenario: Dragging on a phone does not trigger a swipe to the next period
    Given I am using a phone
    When I open the week view for 2026-10-12
    And I drag the event "Dentist" to 2026-10-16 at 14:00
    Then the URL path is "/week/2026-10-12"
    And I see the event "Dentist" on "Friday"
