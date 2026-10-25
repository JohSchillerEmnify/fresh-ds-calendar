@dnd @id:drag-to-reschedule
Feature: Drag and drop to reschedule
  Events and task lists can be dragged to another time and day (week and day views, snapped to
  15-minute slots) or to another day (month view). Touch: long-press to pick up (with a haptic tick where
  the device supports it); mouse: press and drag. The card lifts, follows with a spring and settles on drop.
  The move is saved to Google at once; if saving fails the card springs back and the error banner shows.
  Picking up a timed entry and releasing it without moving shows resize handles on its top and bottom edge
  (day and week views); dragging a handle changes when it starts or ends.
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

  # owner, 2026-10-23: the right one of two side-by-side events jumped away from the finger onto the left one
  @mobile
  Scenario Outline: On a phone the right one of two side-by-side events stays under the finger when picked up (<view> view, <left> and <right>)
    Given I am using a phone
    And the calendar contains an event "Left" on 2026-10-14 from <left>
    And the calendar contains an event "Right" on 2026-10-14 from <right>
    When I pick up the event "Right" in the <view> view for 2026-10-14
    Then the finger is on the event "Right"

    Examples:
      | view | left           | right          |
      | week | 15:00 to 17:00 | 15:00 to 16:00 |
      | week | 15:00 to 17:00 | 15:15 to 16:00 |
      | week | 15:00 to 15:45 | 15:15 to 17:00 |
      | day  | 15:00 to 17:00 | 15:00 to 16:00 |
      | day  | 15:00 to 17:00 | 15:15 to 16:00 |
      | day  | 15:00 to 15:45 | 15:15 to 17:00 |

  # owner, 2026-10-25: on an iPhone dragging did not move anything in any view, on Android not in the month view.
  # @iphone also runs on an iPhone-like WebKit (project iphone); @mobile on an Android-like Chromium.
  @mobile @iphone
  Scenario: On a phone a long press drags an event to another time in the day view
    Given I am using a phone
    When I open the day view for 2026-10-14
    And I drag the event "Dentist" down by 60 minutes
    Then the event "Dentist" is positioned from 10:00 to 11:00
    And Google contains an event "Dentist" on 2026-10-14 from 10:00 to 11:00

  @mobile @iphone
  Scenario: On a phone a long press drags an event to another day and time in the week view
    Given I am using a phone
    When I open the week view for 2026-10-12
    And I drag the event "Dentist" to 2026-10-16 at 14:00
    Then the event "Dentist" is positioned from 14:00 to 15:00
    And Google contains an event "Dentist" on 2026-10-16 from 14:00 to 15:00

  @mobile @iphone
  Scenario: On a phone a long press drags an event to another day in the month view
    Given I am using a phone
    When I open the month view for 2026-10
    And I drag the event "Dentist" to 2026-10-21
    Then I see the event "Dentist" on 2026-10-21
    And Google contains an event "Dentist" on 2026-10-21 from 09:00 to 10:00

  # a finger held still lets the drag itself keep the page from scrolling (the card's own touch listener on iPhone)
  @mobile @iphone
  Scenario: On a phone a drag with a still finger keeps the page from scrolling in the month view
    Given I am using a phone
    When I open the month view for 2026-10
    And I drag the event "Dentist" to 2026-10-21 with a finger held perfectly still
    Then I see the event "Dentist" on 2026-10-21
    And the browser did not take the touch over for scrolling

  @mobile @iphone
  Scenario: On a phone the event dragged in the month view stays visible under the finger
    Given I am using a phone
    When I open the month view for 2026-10
    And I hold the event "Dentist" over 2026-10-21
    Then the dragged event is drawn visibly in the day under the finger

  @mobile @iphone
  Scenario: On a phone a quick swipe that starts on an event still scrolls the day
    Given I am using a phone
    When I open the day view for 2026-10-14
    And I swipe up quickly starting on the event "Dentist"
    Then the time grid has scrolled down
    And the event "Dentist" is not lifted

  Rule: Releasing a timed entry without moving it shows resize handles

    Scenario: Releasing a picked-up event without moving shows resize handles
      When I open the day view for 2026-10-14
      And I pick up the event "Dentist"
      And I release the event without moving it
      Then the event "Dentist" is not lifted
      And the event "Dentist" shows resize handles
      And Google contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00

    Scenario: Dragging the bottom handle changes when the event ends
      Given the event "Dentist" shows resize handles in the day view for 2026-10-14
      When I drag the bottom handle of "Dentist" down by 52 minutes
      Then the event "Dentist" is positioned from 09:00 to 11:00
      And Google contains an event "Dentist" on 2026-10-14 from 09:00 to 11:00

    Scenario: Dragging the top handle changes when the event starts
      Given the event "Dentist" shows resize handles in the day view for 2026-10-14
      When I drag the top handle of "Dentist" up by 30 minutes
      Then the event "Dentist" is positioned from 08:30 to 10:00
      And Google contains an event "Dentist" on 2026-10-14 from 08:30 to 10:00

    Scenario: An event cannot be resized shorter than 15 minutes
      Given the event "Dentist" shows resize handles in the day view for 2026-10-14
      When I drag the bottom handle of "Dentist" up by 90 minutes
      Then the event "Dentist" is positioned from 09:00 to 09:15
      And Google contains an event "Dentist" on 2026-10-14 from 09:00 to 09:15

    Scenario: A failed resize springs the event back
      Given the event "Dentist" shows resize handles in the day view for 2026-10-14
      And Google becomes unavailable
      When I drag the bottom handle of "Dentist" down by 60 minutes
      Then I see the sync error banner
      And the event "Dentist" is positioned from 09:00 to 10:00

    Scenario: Tapping elsewhere hides the resize handles
      Given the event "Dentist" shows resize handles in the day view for 2026-10-14
      When I click the time slot 15:00 on 2026-10-14
      Then the event "Dentist" shows no resize handles
      And the event dialog is closed

    Scenario: Resizing a timed task list changes its estimated duration
      Given the calendar contains a task list "Packing" on 2026-10-15 at 18:00 for 30 minutes with items:
        | item     | done |
        | Passport | no   |
      And the task list "Packing" shows resize handles in the day view for 2026-10-15
      When I drag the bottom handle of "Packing" down by 30 minutes
      Then the Google event for the task list "Packing" is a timed event on 2026-10-15 from 18:00 to 19:00

    Scenario: A task list cannot be resized longer than 12 hours
      Given the calendar contains a task list "Shift" on 2026-10-15 at 08:00 for 600 minutes with items:
        | item  | done |
        | Start | no   |
      And the task list "Shift" shows resize handles in the day view for 2026-10-15
      When I drag the bottom handle of "Shift" down by 180 minutes
      Then the Google event for the task list "Shift" is a timed event on 2026-10-15 from 08:00 to 20:00

    @mobile
    Scenario: On a phone, resizing in the week view does not swipe to the next week
      Given I am using a phone
      And the event "Dentist" shows resize handles in the week view for 2026-10-12
      When I drag the bottom handle of "Dentist" down by 60 minutes
      Then the URL path is "/week/2026-10-12"
      And Google contains an event "Dentist" on 2026-10-14 from 09:00 to 11:00

    # owner, 2026-10-23: a handle is never wider than its own block, so it does not cover a narrow neighbour
    @mobile
    Scenario: On a phone a block's resize handles do not cover the event beside it
      Given I am using a phone
      And the calendar contains an event "Left" on 2026-10-14 from 15:00 to 15:45
      And the calendar contains an event "Right" on 2026-10-14 from 15:15 to 17:00
      And the event "Left" shows resize handles in the week view for 2026-10-14
      When I tap the event "Right" right beside the bottom handle of "Left"
      Then the event form shows:
        | title | Right |
      And the event "Left" shows no resize handles

    Scenario: Entries in the month view show no resize handles
      When I open the month view for 2026-10
      And I pick up the event "Dentist"
      And I release the event without moving it
      Then the event "Dentist" shows no resize handles

  @desktop
  Scenario: Auto-scroll and wheel while dragging keep the card on the drop indicator
    When I open the day view for 2026-10-14
    And I hold the event "Dentist" at the bottom edge of the time grid for 1000 ms
    Then the dragged event is drawn on the drop indicator
    When I move the dragged event to the middle of the time grid
    And I scroll the mouse wheel up by 300 pixels while dragging
    Then the dragged event is drawn on the drop indicator
    When I drop the dragged event
    Then the event "Dentist" starts at the time the drop indicator showed

  @backlog
  Scenario: Dragging a multi-day bar moves the whole event by the days moved
    Given the calendar contains an all-day event "Holiday" from 2026-10-13 to 2026-10-15
    And I open the month view for 2026-10
    When I drag the bar "Holiday" by its day 2026-10-14 to 2026-10-21
    Then I see the event "Holiday" as a bar from 2026-10-20 to 2026-10-22

  # owner, 2026-10-25 (design boards): moving to another day while dragging, like Google Calendar
  Rule: Holding a dragged entry at the side edge of the day or week view flips to the next or previous day or week

    While an event or a task list is dragged in the day or week view (touch or mouse), the strips at the left and right
    side of the day columns are edge zones: the outer 24 px. In an edge zone a band appears along that side naming where a
    turn leads: the day ("‹ Tue 13", "Thu 15 ›") in the day view, the week ("‹ 5–11 Oct", "19–25 Oct ›") in the week
    view. The day view turns after 0.6 s in the zone; the week view, so that Sunday and Monday are not stolen, only after
    1 s (owner, 2026-10-25). Staying in the zone turns again after each such wait. Leaving the zone before then hides the
    band and nothing turns. A drop always lands on the slot under the pointer of the day or week shown, so a drop on the
    rest of the outermost column, after however long a hold, stays there.

    @backlog
    Scenario Outline: Holding a dragged event at the <side> edge of the day view moves on to the <which> day
      When I open the day view for 2026-10-14
      And I hold the event "Dentist" at the <side> edge of the time grid for 300 ms
      Then the edge band says "<band>"
      And the URL path is "/day/2026-10-14"
      When I keep holding the dragged item for 700 ms
      Then the URL path is "/day/<date>"
      And "Dentist" is still being dragged
      When I drop the dragged item on <date> at 11:00
      Then the event "Dentist" is positioned from 11:00 to 12:00
      And Google contains an event "Dentist" on <date> from 11:00 to 12:00

      Examples:
        | side  | which    | band     | date       |
        | right | next     | Thu 15 › | 2026-10-15 |
        | left  | previous | ‹ Tue 13 | 2026-10-13 |

    @backlog
    Scenario Outline: Holding a dragged event at the <side> edge of the week view moves on to the <which> week
      When I open the week view for 2026-10-12
      And I hold the event "Dentist" at the <side> edge of the time grid for 300 ms
      Then the edge band says "<band>"
      And the URL path is "/week/2026-10-12"
      When I keep holding the dragged item for 1000 ms
      Then the URL path is "/week/<week>"
      And "Dentist" is still being dragged
      When I drop the dragged item on <date> at 09:00
      Then the event "Dentist" is positioned on <date> from 09:00 to 10:00
      And Google contains an event "Dentist" on <date> from 09:00 to 10:00

      Examples:
        | side  | which    | band        | week       | date       |
        | right | next     | 19–25 Oct › | 2026-10-19 | 2026-10-21 |
        | left  | previous | ‹ 5–11 Oct  | 2026-10-05 | 2026-10-07 |

    @backlog
    Scenario: Staying at the edge keeps turning the days
      When I open the day view for 2026-10-14
      And I hold the event "Dentist" at the right edge of the time grid for 1500 ms
      Then the URL path is "/day/2026-10-16"
      And the edge band says "Sat 17 ›"
      When I drop the dragged item on 2026-10-16 at 09:00
      Then Google contains an event "Dentist" on 2026-10-16 from 09:00 to 10:00

    @backlog
    Scenario: A timed task list can be carried to the next day the same way
      Given the calendar contains a task list "Packing" on 2026-10-15 at 18:00 with items:
        | item     | done |
        | Passport | no   |
      When I open the day view for 2026-10-15
      And I hold the task list "Packing" at the right edge of the time grid for 1000 ms
      Then the URL path is "/day/2026-10-16"
      When I drop the dragged item on 2026-10-16 at 08:15
      Then the task list "Packing" is positioned at 08:15
      And the Google event for the task list "Packing" is a timed event on 2026-10-16 from 08:15 to 08:45

    @backlog
    Scenario: Leaving the edge before the view turns keeps the day
      When I open the day view for 2026-10-14
      And I hold the event "Dentist" at the right edge of the time grid for 300 ms
      And I move the dragged event to the middle of the time grid
      Then I see no edge band
      When I keep holding the dragged item for 1000 ms
      Then the URL path is "/day/2026-10-14"
      When I drop the dragged event
      Then I see the event "Dentist" on 2026-10-14
      And the event "Dentist" starts at the time the drop indicator showed

    # owner, 2026-10-25: the week turn must not steal Sunday
    @backlog
    Scenario: Dropping in the middle of Sunday after a long hold stays on Sunday
      When I open the week view for 2026-10-12
      And I hold the event "Dentist" over 2026-10-18 at 09:00 for 1500 ms
      Then I see no edge band
      And the URL path is "/week/2026-10-12"
      When I drop the dragged event
      Then Google contains an event "Dentist" on 2026-10-18 from 09:00 to 10:00

    # owner, 2026-10-25: all-day entries turn the day or week the same way
    @backlog
    Scenario: An all-day event held at the edge of the all-day row moves on to the next week
      Given the calendar contains an all-day event "Trip" from 2026-10-14 to 2026-10-14
      When I open the week view for 2026-10-12
      And I hold the all-day event "Trip" at the right edge of the all-day row for 1500 ms
      Then the URL path is "/week/2026-10-19"
      When I drop the dragged item in the all-day row on 2026-10-21
      Then I see the all-day event "Trip" on 2026-10-21
      And Google contains an all-day event "Trip" from 2026-10-21 to 2026-10-21

    @mobile @backlog
    Scenario: On a phone a quick drop on the last day of the week still lands there
      Given I am using a phone
      When I open the week view for 2026-10-12
      And I drag the event "Dentist" to 2026-10-18 at 14:00
      Then the URL path is "/week/2026-10-12"
      And Google contains an event "Dentist" on 2026-10-18 from 14:00 to 15:00
