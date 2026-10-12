@events @display
Feature: Displaying events in the calendar views
  Times are local times in Europe/Berlin. Timed events are placed in the time grid of the
  week and day views; all-day events are placed in the all-day area. Multi-day events are
  drawn as solid bars across the days they cover (cut at the week edge); timed events under
  24 hours that cross midnight are shown as one block per day.

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00

  Scenario Outline: A timed event appears in every view
    When I open the <view> view for <period>
    Then I see the event "Dentist" on 2026-10-14

    Examples:
      | view  | period     |
      | month | 2026-10    |
      | week  | 2026-10-12 |
      | day   | 2026-10-14 |

  Scenario Outline: A timed event shows its start time
    When I open the <view> view for <period>
    Then the event "Dentist" shows the time "09:00"

    Examples:
      | view  | period     |
      | week  | 2026-10-12 |
      | day   | 2026-10-14 |

  @month @desktop
  Scenario: A timed event chip in the desktop month view shows its start time
    When I open the month view for 2026-10
    Then the event "Dentist" shows the time "09:00"

  @week
  Scenario: A timed event is placed in its weekday column at its time
    When I open the week view for 2026-10-12
    Then I see the event "Dentist" on "Wednesday"
    And the event "Dentist" is positioned from 09:00 to 10:00

  @day
  Scenario: A timed event is placed at its time in the day view
    When I open the day view for 2026-10-14
    Then the event "Dentist" is positioned from 09:00 to 10:00

  Scenario Outline: Events outside the visible period are not shown
    When I open the <view> view for <period>
    Then I do not see the event "Dentist"

    Examples:
      | view  | period     |
      | month | 2026-11    |
      | week  | 2026-10-19 |
      | day   | 2026-10-13 |

  @week
  Scenario: Events after the end of daylight saving time keep their wall-clock time
    Given the calendar contains an event "Physio" on 2026-10-26 from 09:00 to 10:00
    When I open the week view for 2026-10-26
    Then the event "Physio" is positioned from 09:00 to 10:00

  Scenario Outline: An all-day event is shown in the all-day area
    Given the calendar contains an all-day event "Holiday" on 2026-10-16
    When I open the <view> view for <period>
    Then I see the all-day event "Holiday" on 2026-10-16

    Examples:
      | view  | period     |
      | month | 2026-10    |
      | week  | 2026-10-12 |
      | day   | 2026-10-16 |

  @month
  Scenario: A multi-day all-day event is shown as a bar across the days it covers in the month view
    Given the calendar contains an all-day event "Trip" from 2026-10-17 to 2026-10-20
    When I open the month view for 2026-10
    Then I see the event "Trip" on each day from 2026-10-17 to 2026-10-20
    And I see the event "Trip" as a bar from 2026-10-17 to 2026-10-18
    And I see the event "Trip" as a bar from 2026-10-19 to 2026-10-20
    And I do not see the event "Trip" on 2026-10-16
    And I do not see the event "Trip" on 2026-10-21

  @week
  Scenario: A multi-day all-day event crossing a week boundary is cut at the week edge
    Given the calendar contains an all-day event "Trip" from 2026-10-17 to 2026-10-20
    When I open the week view for 2026-10-12
    Then I see the event "Trip" as a bar from 2026-10-17 to 2026-10-18
    When I go to the next period
    Then I see the event "Trip" as a bar from 2026-10-19 to 2026-10-20
    And I do not see the event "Trip" on 2026-10-21

  @month
  Scenario: Overlapping multi-day events are stacked in separate lanes
    Given the calendar contains an all-day event "Trip" from 2026-10-13 to 2026-10-16
    And the calendar contains an all-day event "Course" from 2026-10-14 to 2026-10-17
    When I open the month view for 2026-10
    Then the event "Trip" is a bar in lane 0
    And the event "Course" is a bar in lane 1

  @week
  Scenario: A timed event lasting a day or longer is a bar
    Given the calendar contains an event "Conference" from 2026-10-14 10:00 to 2026-10-15 12:00
    When I open the week view for 2026-10-12
    Then I see the event "Conference" as a bar from 2026-10-14 to 2026-10-15

  @week
  Scenario: A timed event crossing midnight is shown on both days
    Given the calendar contains an event "Night shift" from 2026-10-14 22:00 to 2026-10-15 02:00
    When I open the week view for 2026-10-12
    Then I see the event "Night shift" on each day from 2026-10-14 to 2026-10-15
    And the event "Night shift" is positioned on 2026-10-14 from 22:00 to 24:00
    And the event "Night shift" is positioned on 2026-10-15 from 00:00 to 02:00

  @week @overlap
  Scenario: Events starting at nearly the same time are shown side by side in the week view
    Given the calendar contains an event "Standup" on 2026-10-14 from 09:10 to 10:30
    When I open the week view for 2026-10-12
    Then the events "Dentist" and "Standup" do not overlap
    And the events "Dentist" and "Standup" are side by side

  @week @overlap
  Scenario: An overlapping event starting 15 minutes or more later is stacked on top
    Given the calendar contains an event "Standup" on 2026-10-14 from 09:30 to 10:30
    When I open the week view for 2026-10-12
    Then the event "Standup" is stacked on the event "Dentist"

  @day @overlap
  Scenario: Three mutually overlapping events are cascaded in the day view
    Given the calendar contains an event "Standup" on 2026-10-14 from 09:30 to 10:30
    And the calendar contains an event "Call" on 2026-10-14 from 09:45 to 11:00
    When I open the day view for 2026-10-14
    Then the event "Standup" is stacked on the event "Dentist"
    And the event "Call" is stacked on the event "Standup"

  @day @overlap
  Scenario: A short task list does not cover the entry right after it
    Given the calendar contains a task list "Call mum" on 2026-10-14 at 20:00 for 15 minutes with items:
      | item             | done |
      | Ask about Sunday | no   |
    And the calendar contains an event "Foo" on 2026-10-14 from 20:15 to 21:00
    When I open the day view for 2026-10-14
    Then the title of the event "Foo" is not covered

  @day @overlap
  Scenario: Back-to-back events do not count as overlapping
    Given the calendar contains an event "Gym" on 2026-10-14 from 10:00 to 11:00
    When I open the day view for 2026-10-14
    Then the event "Dentist" spans the full width of its day column
    And the event "Gym" spans the full width of its day column

  @month @desktop
  Scenario: Items of a day are ordered all-day first, then by time
    Given the calendar contains an all-day event "Holiday" on 2026-10-14
    And the calendar contains an event "Gym" on 2026-10-14 from 07:00 to 08:00
    And the calendar contains a task list "Errands" on 2026-10-14 at 08:30 with items:
      | item  | done |
      | Post  | no   |
    When I open the month view for 2026-10
    Then the items on 2026-10-14 are shown in the order "Holiday, Gym, Errands, Dentist"

  @month @desktop
  Scenario: A crowded day in the month view fades out what does not fit
    Given the calendar contains an event "A" on 2026-10-14 from 11:00 to 12:00
    And the calendar contains an event "B" on 2026-10-14 from 12:00 to 13:00
    And the calendar contains an event "C" on 2026-10-14 from 13:00 to 14:00
    And the calendar contains an event "D" on 2026-10-14 from 14:00 to 15:00
    And the calendar contains an event "E" on 2026-10-14 from 15:00 to 16:00
    And the calendar contains an event "F" on 2026-10-14 from 16:00 to 17:00
    And the calendar contains an event "G" on 2026-10-14 from 17:00 to 18:00
    And the calendar contains an event "H" on 2026-10-14 from 18:00 to 19:00
    When I open the month view for 2026-10
    Then the entries on 2026-10-14 fade out towards the bottom of the month cell
    And the month cell of 2026-10-14 shows no overflow count
    When I click empty space in the month cell of 2026-10-14
    Then the URL path is "/day/2026-10-14"
    And I see the event "H" on 2026-10-14

  Scenario: Events take the color of their calendar
    Given the calendar contains an event "Team sync" in the calendar "Work" on 2026-10-13 from 10:00 to 11:00
    When I open the week view for 2026-10-12
    Then the event "Team sync" has the color "#0b8043"
    And the event "Dentist" has the color "#039be5"
