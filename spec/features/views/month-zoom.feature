@month @month-zoom @id:month-zoom
Feature: Zooming the month view
  Owner, 2026-10-16: "Zooming is broken on the month overview"; owner, 2026-10-23: the month view gets its own zoom
  (not the browser's page zoom, and the Labs zoom month stays a separate view).
  A pinch on the month view (or Ctrl or Cmd with the wheel on a desktop) makes the week rows taller, so each day shows
  more of its entries; the seven day columns always fill the width, so the zoom never pans sideways and a sideways
  swipe still changes the month. The smallest zoom is today's month view, where the whole month fits the screen;
  zoomed in, the month scrolls up and down. The bars, the top bar and the weekday row keep their size: it is the
  month that zooms, never the whole page. The zoom stays on the device it was set on, like the time grid's zoom, and
  holds for every month. In the month list ("Month view scrolls: Up and down") the pinch changes the fixed week height.

  Root cause of "broken" (2026-11-01, reproduced on the live build in phone emulation): the month view never had a zoom.
  On touch screens the swipe area (`SwipeCarousel.vue`, `.main { touch-action: pan-y }`) also blocks the browser's own
  pinch zoom, so a pinch does nothing at all; on a desktop, Ctrl+wheel reaches the browser and zooms the whole page;
  the Android app has no page zoom. The zoom in the app exists only for the time grid (`bindGridZoom`), the Canvas and
  the Labs views.

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And the calendar contains an event "Standup" on 2026-10-14 from 09:00 to 09:15
    And the calendar contains an event "Dentist" on 2026-10-14 from 10:00 to 11:00
    And the calendar contains an event "Lunch with Anna" on 2026-10-14 from 12:30 to 13:30
    And the calendar contains an event "Yoga" on 2026-10-14 from 18:00 to 19:00
    And the calendar contains an event "Kino" on 2026-10-28 from 20:00 to 21:30

  @backlog
  Scenario: Pinching the month makes the weeks taller and shows more of each day
    When I open the month view for 2026-10
    Then the month cell of 2026-10-14 leaves out the entry "Yoga"
    When I note the height of the week rows of the month view
    And I pinch out on the month view to twice the size
    Then the week rows of the month view are about twice as tall as noted
    And the month view shows 7 day columns across the screen
    And I see the event "Yoga" on 2026-10-14

  @backlog
  Scenario: Zoomed in, the month scrolls up and down
    When I open the month view for 2026-10
    And I pinch out on the month view to twice the size
    And I scroll the month view down to 2026-10-28
    Then I see the event "Kino" on 2026-10-28
    And the URL path is "/month/2026-10"

  @backlog
  Scenario: Pinching never changes the month and a swipe still does
    When I open the month view for 2026-10
    And I note the height of the week rows of the month view
    And I pinch out on the month view to twice the size
    Then the URL path is "/month/2026-10"
    When I swipe left on the calendar
    Then the URL path is "/month/2026-11"
    And the week rows of the month view are about twice as tall as noted

  @backlog
  Scenario: The whole month on one screen is the smallest zoom
    When I open the month view for 2026-10
    And I pinch in on the month view to half the size
    Then the week rows of the month view have their default height

  @backlog
  Scenario: Only the month zooms, not the page
    When I open the month view for 2026-10
    And I note the height of the top bar
    And I pinch out on the month view to twice the size
    Then the top bar is as tall as noted
    And the page itself is not zoomed

  @backlog @desktop
  Scenario: Ctrl with the wheel zooms the month on a desktop
    When I open the month view for 2026-10
    And I note the height of the week rows of the month view
    And I zoom the month view in with Ctrl+wheel
    Then the week rows of the month view are taller than noted
    And the page itself is not zoomed

  @backlog
  Scenario: The month zoom is remembered on this device only
    When I open the month view for 2026-10
    And I note the height of the week rows of the month view
    And I pinch out on the month view to twice the size
    And I reload the page
    Then the week rows of the month view are about twice as tall as noted
    When I switch to another device
    And I open the month view for 2026-10
    Then the week rows of the month view have their default height

  @backlog
  Scenario: In the month list the pinch changes the week height
    Given the month view scrolls up and down
    When I open the month view for 2026-10
    And I note the height of the week rows of the month view
    And I pinch out on the month view to twice the size
    Then the week rows of the month view are about twice as tall as noted
