@events @display @id:event-display
Feature: Displaying events in the calendar views
  Times are local times in Europe/Berlin. Timed events are placed in the time grid of the
  week and day views; all-day events are placed in the all-day area. Multi-day events are
  drawn as solid bars across the days they cover (cut at the week edge); timed events under
  24 hours that cross midnight are shown as one block per day in the week and day views, and
  on their start day only in the month view, like Google Calendar (owner, 2026-10-25). So an
  event from a Sunday 22:00 to Monday 02:00 on the last day of a month is not shown in the
  next month's view at all; Google Calendar behaves the same way.

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

  @month @month-lanes
  Scenario: A multi-day bar does not push down the days it does not cover
    Given the calendar contains an all-day event "Summit" from 2026-10-05 to 2026-10-08
    And the calendar contains an event "Verena" on 2026-10-09 from 10:00 to 11:00
    And the calendar contains an event "Fitti" on 2026-10-07 from 18:00 to 19:00
    When I open the month view for 2026-10
    Then the first entry of the month cell of 2026-10-09 is at the height of the bar "Summit"
    And the first entry of the month cell of 2026-10-07 is in the slot below the bar "Summit"

  @week @day @allday-slots
  Scenario Outline: A multi-day bar does not push down the all-day entries of days it does not cover
    Given the calendar contains an all-day event "Summit" from 2026-10-12 to 2026-10-14
    And the calendar contains an all-day event "Holiday" on 2026-10-16
    When I open the <view> view for <period>
    Then the all-day event "Holiday" on 2026-10-16 is at the height of the bar "Summit"

    Examples:
      | view | period     |
      | week | 2026-10-12 |
      | day  | 2026-10-16 |

  @month @month-lanes
  Scenario: A day's entries fill the free slot above a bar
    Given the calendar contains an all-day event "Trip" from 2026-10-13 to 2026-10-16
    And the calendar contains an all-day event "Course" from 2026-10-14 to 2026-10-17
    And the calendar contains an event "Fitti" on 2026-10-17 from 17:00 to 18:00
    When I open the month view for 2026-10
    Then the event "Trip" is a bar in lane 0
    And the event "Course" is a bar in lane 1
    And the first entry of the month cell of 2026-10-17 is at the height of the bar "Trip"

  @month @month-lanes
  Scenario: Bars look like the chips in the month view
    Given the calendar contains an all-day event "Trip" from 2026-10-17 to 2026-10-20
    And the calendar contains an event "Fitti" on 2026-10-16 from 17:00 to 18:00
    When I open the month view for 2026-10
    Then the bar "Trip" has the height of the chip "Fitti"
    And the bar "Trip" shows no continuation arrows

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

  @month
  Scenario: A timed event crossing midnight is shown on its start day only in the month view
    Given the calendar contains an event "Night shift" from 2026-10-14 22:00 to 2026-10-15 02:00
    When I open the month view for 2026-10
    Then I see the event "Night shift" on 2026-10-14
    And I do not see the event "Night shift" on 2026-10-15

  @week @overlap
  Scenario: Events starting at nearly the same time are shown side by side in the week view
    Given the calendar contains an event "Standup" on 2026-10-14 from 09:10 to 10:30
    When I open the week view for 2026-10-12
    Then the events "Dentist" and "Standup" do not overlap
    And the events "Dentist" and "Standup" are side by side

  @day @overlap
  Scenario: A short task list does not cover the entry right after it
    Given the calendar contains a task list "Call mum" on 2026-10-14 at 20:00 for 15 minutes with items:
      | item             | done |
      | Ask about Sunday | no   |
    And the calendar contains an event "Foo" on 2026-10-14 from 20:15 to 21:00
    When I open the day view for 2026-10-14
    Then the title of the event "Foo" is not covered

  @day @overlap
  Scenario: A short task list right before an event stays readable
    Given the calendar contains a task list "Shopping" on 2026-10-14 at 17:00 for 15 minutes with items:
      | item  | done |
      | Chips | no   |
    And the calendar contains an event "Evening" on 2026-10-14 from 17:15 to 21:30
    And the calendar contains an event "Rehearsal" on 2026-10-14 from 19:00 to 22:00
    When I open the day view for 2026-10-14
    Then the title of the task list "Shopping" is not covered
    And the title of the event "Evening" is not covered

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

  @month @desktop
  Scenario: Entries completely hidden under the fade of a month cell are not in the page
    Owner, 2026-10-24: an entry that cannot be seen at all in its month cell is not built, so a busy month renders
    faster. Accepted: a screen reader no longer lists it in the month grid; the week and day views still show it.
    Given the calendar contains these events on 2026-10-14:
      | title | from  | to    |
      | E01   | 10:00 | 10:30 |
      | E02   | 10:30 | 11:00 |
      | E03   | 11:00 | 11:30 |
      | E04   | 11:30 | 12:00 |
      | E05   | 12:00 | 12:30 |
      | E06   | 12:30 | 13:00 |
      | E07   | 13:00 | 13:30 |
      | E08   | 13:30 | 14:00 |
      | E09   | 14:00 | 14:30 |
      | E10   | 14:30 | 15:00 |
      | E11   | 15:00 | 15:30 |
      | E12   | 15:30 | 16:00 |
    When I open the month view for 2026-10
    Then I see the event "Dentist" on 2026-10-14
    And every entry in the month cell of 2026-10-14 can be seen at least in part
    And the month cell of 2026-10-14 leaves out the entry "E12"
    And the entries on 2026-10-14 fade out towards the bottom of the month cell
    And the month cell of 2026-10-14 shows no overflow count
    When I click empty space in the month cell of 2026-10-14
    Then I see the event "E12" on 2026-10-14

  @month @mobile
  Scenario: Entries completely hidden under the fade of a phone month cell are not in the page
    The same on a phone, where the cell and its entries are smaller.
    Given the calendar contains these events on 2026-10-14:
      | title | from  | to    |
      | E01   | 10:00 | 10:30 |
      | E02   | 10:30 | 11:00 |
      | E03   | 11:00 | 11:30 |
      | E04   | 11:30 | 12:00 |
      | E05   | 12:00 | 12:30 |
      | E06   | 12:30 | 13:00 |
    When I open the month view for 2026-10
    Then I see the event "Dentist" on 2026-10-14
    And every entry in the month cell of 2026-10-14 can be seen at least in part
    And the month cell of 2026-10-14 leaves out the entry "E06"
    And the entries on 2026-10-14 fade out towards the bottom of the month cell
    When I tap the day 2026-10-14 in the month view
    Then I see the event "E06" on 2026-10-14

  @month @desktop
  Scenario: Task list cards in a narrow month grid do not flicker
    Given the browser window is 672 by 1180 pixels wide and high
    And the calendar contains a task list "Groceries" on 2026-10-14 with items:
      | item  | done |
      | Milk  | no   |
      | Bread | no   |
      | Eggs  | no   |
    And the calendar contains a task list "Chores" on 2026-10-15 with items:
      | item    | done |
      | Laundry | no   |
    When I open the month view for 2026-10
    Then the month cells stay unchanged for 3 seconds

  Scenario: Events take the color of their calendar
    Given the calendar contains an event "Team sync" in the calendar "Work" on 2026-10-13 from 10:00 to 11:00
    When I open the week view for 2026-10-12
    Then the event "Team sync" has the color "#0b8043"
    And the event "Dentist" has the color "#039be5"

  @day
  Scenario: A long event shows its location when there is room
    Given the calendar contains an event "Workshop" on 2026-10-14 from 13:00 to 16:00 at "Room 4, Main St 12"
    When I open the day view for 2026-10-14
    Then the event "Workshop" shows the location "Room 4, Main St 12"

  Rule: An event repeating in Google shows on every day it occurs, and changing one occurrence changes only that one

    @backlog
    Scenario: A weekly event from Google shows in every week it occurs
      Given Google has an event "Yoga" repeating every week from 2026-10-06 from 18:00 to 19:00
      When I open the month view for 2026-10
      Then I see the event "Yoga" on each of 2026-10-06, 2026-10-13, 2026-10-20 and 2026-10-27

    @backlog
    Scenario: Moving one occurrence of a repeating event moves only that one
      Given Google has an event "Yoga" repeating every week from 2026-10-06 from 18:00 to 19:00
      When I move the "Yoga" of 2026-10-13 to 2026-10-14
      Then I see the event "Yoga" on each of 2026-10-06, 2026-10-14, 2026-10-20 and 2026-10-27

  # owner, 2026-10-25 (design boards): overlapping events sit next to each other instead of cascading, up to a set number
  Rule: Overlapping entries sit side by side up to the number of columns set for the view

    Settings › Calendar has "Day view: events side by side" (Up to 2, 3 or 4; default Up to 4) and "Week view: events
    side by side" (Up to 2 or 3; default Up to 2), for the day and week time grids on every screen size (the two-row week
    overview counts as the week view; the Labs views keep their own layout). Entries that overlap in time are placed
    one by one, earliest start first (same start: the longer first; same start and end: in the day's usual order). Each
    takes the leftmost column that is free at its start; when none is free and fewer columns than the limit are in use, it
    opens a new column on the right. An overlap group shares the width in as many equal columns as it uses, and a block
    still widens into free columns to its right. When all columns are busy, the entry is laid over the last column,
    shifted a little to the right per level (up to 3 levels) and drawn on top, as cascades are today; that column then
    stays busy until everything over it has ended. To keep titles readable, an entry that would be laid over a block
    starting less than 15 minutes (or one title row) before it gets one more column instead, beyond the limit, but only
    one: with the limit + 1 columns in use, further entries are laid over the last column even if a title is covered.

    @day @overlap
    Scenario: Four overlapping events share the day view in four columns by default
      Given the calendar contains an event "Standup" on 2026-10-14 from 09:00 to 10:30
      And the calendar contains an event "Call" on 2026-10-14 from 09:00 to 10:30
      And the calendar contains an event "Review" on 2026-10-14 from 09:30 to 11:00
      When I open the day view for 2026-10-14
      Then the entries "Dentist, Standup, Call, Review" each take one of 4 equal columns

    @day @overlap
    Scenario: With up to 3 in the day view a fourth overlapping event is laid over the last column
      Given the day view shows up to 3 events side by side
      And the calendar contains an event "Standup" on 2026-10-14 from 09:00 to 10:30
      And the calendar contains an event "Call" on 2026-10-14 from 09:00 to 10:30
      And the calendar contains an event "Review" on 2026-10-14 from 09:30 to 11:00
      When I open the day view for 2026-10-14
      Then the entries "Dentist, Standup, Call" each take one of 3 equal columns
      And the event "Review" is stacked on the event "Dentist"

    @week @overlap
    Scenario: The week view shows up to 2 side by side by default and lays further ones over the last column
      Given the calendar contains an event "Standup" on 2026-10-14 from 09:00 to 10:30
      And the calendar contains an event "Call" on 2026-10-14 from 09:30 to 11:00
      And the calendar contains an event "Review" on 2026-10-14 from 10:00 to 11:30
      When I open the week view for 2026-10-12
      Then the entries "Standup, Dentist" each take one of 2 equal columns
      And the event "Call" is stacked on the event "Dentist"
      And the event "Review" is stacked on the event "Call"

    @week @overlap
    Scenario: A later event takes the column an earlier one has left
      Given the calendar contains an event "Standup" on 2026-10-14 from 09:15 to 10:30
      And the calendar contains an event "Gym" on 2026-10-14 from 10:00 to 11:00
      When I open the week view for 2026-10-12
      Then the entries "Dentist, Standup" each take one of 2 equal columns
      And the entries "Gym, Standup" each take one of 2 equal columns

    @week @overlap
    Scenario: With up to 3 in the week view three overlapping events sit side by side
      Given the week view shows up to 3 events side by side
      And the calendar contains an event "Standup" on 2026-10-14 from 09:00 to 10:30
      And the calendar contains an event "Call" on 2026-10-14 from 09:30 to 11:00
      When I open the week view for 2026-10-12
      Then the entries "Dentist, Standup, Call" each take one of 3 equal columns

    @day @overlap
    Scenario: Entries starting at nearly the same time get one more column rather than hide a title
      Given the day view shows up to 2 events side by side
      And the calendar contains an event "Standup" on 2026-10-14 from 09:00 to 10:00
      And the calendar contains an event "Call" on 2026-10-14 from 09:05 to 10:00
      When I open the day view for 2026-10-14
      Then the entries "Dentist, Standup, Call" each take one of 3 equal columns

    # owner, 2026-10-25: the extra column for a title is one at most
    @week @overlap
    Scenario: Only one extra column is added for titles; a further close start is laid over the last column
      Given the calendar contains an event "Standup" on 2026-10-14 from 09:05 to 10:30
      And the calendar contains an event "Call" on 2026-10-14 from 09:05 to 10:00
      And the calendar contains an event "Review" on 2026-10-14 from 09:10 to 10:00
      When I open the week view for 2026-10-12
      Then the entries "Dentist, Standup, Call" each take one of 3 equal columns
      And the event "Review" is stacked on the event "Call"

    @week @overlap @two-row
    Scenario: The two-row week overview follows the week view's limit
      Given the calendar contains an event "Standup" on 2026-10-14 from 09:00 to 10:30
      And the calendar contains an event "Call" on 2026-10-14 from 09:30 to 11:00
      When I look at 2026-10-14 in the two-row week overview
      Then the entries "Standup, Dentist" each take one of 2 equal columns
      And the event "Call" is stacked on the event "Dentist"

    # owner, 2026-10-25 (D3): a narrow block uses its tight padding, so a stacked block in a phone week column stays inside it
    @mobile @overlap
    Scenario: On a phone a block laid over a narrow week column stays inside its day column
      Given I am using a phone
      And the calendar contains an event "Standup" on 2026-10-14 from 09:00 to 10:30
      And the calendar contains an event "Call" on 2026-10-14 from 09:30 to 11:00
      And the calendar contains an event "Review" on 2026-10-14 from 10:00 to 11:30
      When I open the week view for 2026-10-12
      Then the event "Review" is stacked on the event "Call"
      And the event "Review" has the narrow block padding
      And the event "Review" stays inside its day column

    @desktop @overlap
    Scenario Outline: A wide block keeps its normal padding and title size (<entries> entries)
      Given the entries are drawn "<entries>"
      When I open the day view for 2026-10-14
      Then the event "Dentist" has a <border> px entry border
      And the event "Dentist" has the normal block padding

      Examples:
        | entries | border |
        | solid   | 0      |
        | tinted  | 3      |
        | outline | 4      |

    @mobile @overlap @two-row
    Scenario Outline: A block of 84 px or less uses the tight padding and the small title together (<entries> entries)
      Given the entries are drawn "<entries>"
      And the two-row week overview is on
      And the calendar contains an event "Workshop" on 2026-10-12 from 13:00 to 16:00
      When I open the week of 2026-10-12 on a phone
      Then the event "Workshop" has a <border> px entry border
      And the event "Workshop" has the narrow block padding

      Examples:
        | entries | border |
        | solid   | 0      |
        | tinted  | 3      |
        | outline | 4      |

    @mobile @overlap
    Scenario: A narrow block in the phone week view shows its time but not its duration
      Given I am using a phone
      And the calendar contains an event "Workshop" on 2026-10-12 from 13:00 to 16:00
      When I open the week view for 2026-10-12
      Then the event "Workshop" has the narrow block padding
      And the event "Workshop" shows the time "13:00–16:00"

    Scenario: Choosing up to 2 for the day view in the settings changes it right away
      Given the calendar contains an event "Standup" on 2026-10-14 from 09:00 to 10:30
      And the calendar contains an event "Call" on 2026-10-14 from 09:30 to 11:00
      And I am on the settings screen
      When I choose up to 2 events side by side in the day view
      And I open the day view for 2026-10-14
      Then the entries "Standup, Dentist" each take one of 2 equal columns
      And the event "Call" is stacked on the event "Dentist"

    Scenario: Choosing up to 3 for the week view in the settings changes it right away
      Given the calendar contains an event "Standup" on 2026-10-14 from 09:00 to 10:30
      And the calendar contains an event "Call" on 2026-10-14 from 09:30 to 11:00
      And I am on the settings screen
      When I choose up to 3 events side by side in the week view
      And I open the week view for 2026-10-12
      Then the entries "Dentist, Standup, Call" each take one of 3 equal columns
