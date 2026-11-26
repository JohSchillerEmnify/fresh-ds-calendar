@week @two-row @id:two-row-week @area:views
Feature: Two-row week overview
  On a narrow screen the week's seven day columns are too thin to read. Turned on, the week
  is laid out in two rows so the whole week — every day and its entries to scale — is visible
  at once without scrolling. Today it is an experimental setting in Labs, off by default, the same
  on every device. Issue 192, owner: "We should maybe have a toggle per layout if the week is in
  one or two rows, so on tablet it could be two on phone 1 row." Owner decisions: two separate
  choices, phone and tablet/desktop, per person and leaving Labs ("Per device size"); the default
  is one row on both sizes until changed ("One row everywhere"); the split (how many days sit on
  the top row) is one shared choice for both sizes ("One shared"). The spec proposes the rest:
  the phone is a window up to 767 px wide, tablets and desktops are wider, the window width at
  that moment decides, and the two switches sit in Settings › Views under the labels used below
  (placement and labels are still open, pending the mockup). In the scenarios above "the
  two-row week overview is on" means both sizes are on.

  Background:
    Given the calendar is empty
    And tapping a task list grows it in place
    And today is 2026-10-12

  Scenario: The whole week is visible at once in two rows
    Given the two-row week overview is on
    And the calendar contains an event "Standup" on 2026-10-12 from 09:00 to 09:30
    And the calendar contains an event "Kino" on 2026-10-18 from 20:00 to 21:30
    When I open the week of 2026-10-12 on a phone
    Then all seven days are laid out in two rows
    And I see both "Standup" and "Kino" without scrolling

  Scenario: By default four days sit on top and three below
    Given the two-row week overview is on
    When I open the week of 2026-10-12 on a phone
    Then Monday to Thursday are on the top row
    And Friday to Sunday are on the bottom row

  Scenario: Switching the split moves the fourth day down
    Given the two-row week overview is on
    And the split is set to three days on top
    When I open the week of 2026-10-12 on a phone
    Then Monday to Wednesday are on the top row
    And Thursday to Sunday are on the bottom row

  Scenario: Days show their entries to scale
    Given the two-row week overview is on
    And the calendar contains an event "Lunch" on 2026-10-12 from 12:00 to 13:00
    And the calendar contains an event "Workshop" on 2026-10-12 from 13:00 to 16:00
    When I open the week of 2026-10-12 on a phone
    Then "Workshop" is about 3 times as tall as "Lunch"

  Scenario: A very short entry still shows its title
    Given the two-row week overview is on
    And the calendar contains an event "Standup" on 2026-10-12 from 09:00 to 09:15
    When I open the week of 2026-10-12 on a phone
    Then I see "Standup"

  Scenario: Empty early and late hours are trimmed so the week fits
    Given the two-row week overview is on
    And the calendar contains an event "Standup" on 2026-10-12 from 09:00 to 09:30
    And the calendar contains an event "Kino" on 2026-10-18 from 20:00 to 21:30
    When I open the week of 2026-10-12 on a phone
    Then every day spans the same hours, from the week's earliest entry to its latest
    And no empty hours are shown before "Standup" or after "Kino"

  Scenario: Tapping an entry opens it
    Given the two-row week overview is on
    And the calendar contains an event "Standup" on 2026-10-12 from 09:00 to 09:30
    When I open the week of 2026-10-12 on a phone
    And I tap "Standup"
    Then the event "Standup" opens

  Scenario: Tapping a day opens that day
    Given the two-row week overview is on
    When I open the week of 2026-10-12 on a phone
    And I tap the empty area of 2026-10-13
    Then the day view for 2026-10-13 opens

  Scenario: Tapping a task list expands it inline in the calendar
    Given the two-row week overview is on
    And the calendar contains a task list "Weekend chores" on 2026-10-12 at 17:00 for 90 minutes with items:
      | Vacuum the flat |
      | Water the plants |
    When I open the week of 2026-10-12 on a phone
    And I tap "Weekend chores"
    Then "Weekend chores" expands in place and shows "Vacuum the flat"
    And the week is still shown behind it, not replaced by a separate sheet

  Scenario: All-day entries sit in each day's band above the timed area
    Given the two-row week overview is on
    And the calendar contains an all-day event "Trip" on 2026-10-12
    And the calendar contains an event "Standup" on 2026-10-12 from 09:00 to 09:30
    When I open the week of 2026-10-12 on a phone
    Then "Trip" is in the all-day band of 2026-10-12, above the timed entries

  Scenario: By default the week keeps its single row of seven columns
    Given the calendar contains an event "Standup" on 2026-10-12 from 09:00 to 09:30
    When I open the week of 2026-10-12 on a phone
    Then the seven days are side by side in a single row

  Rule: The choice is made per screen size

    @backlog
    Scenario: Two rows on tablets only leaves the phone with one row
      Given the week is in two rows on tablets and desktops
      When I open the week of 2026-10-12 on a phone
      Then the seven days are side by side in a single row

    @backlog
    Scenario: Two rows on tablets only gives a tablet two rows
      Given the week is in two rows on tablets and desktops
      And the calendar contains an event "Standup" on 2026-10-12 from 09:00 to 09:30
      When I open the week of 2026-10-12 on a tablet
      Then all seven days are laid out in two rows
      And I see "Standup"

    @backlog
    Scenario: Two rows on phones only leaves the tablet with one row
      Given the week is in two rows on phones
      When I open the week of 2026-10-12 on a tablet
      Then the seven days are side by side in a single row

    @backlog
    Scenario: Two rows on phones only gives a phone two rows
      Given the week is in two rows on phones
      When I open the week of 2026-10-12 on a phone
      Then all seven days are laid out in two rows

    @backlog
    Scenario Outline: The window width decides which choice applies
      Given the week is in two rows on phones
      When I open the week of 2026-10-12 in a window <width> px wide
      Then the week is shown in <rows>

      Examples:
        | width | rows       |
        | 767   | two rows   |
        | 768   | one row    |

    @backlog
    Scenario: Resizing the window switches the layout without reloading
      Given the week is in two rows on tablets and desktops
      And I open the week of 2026-10-12 in a window 1024 px wide
      When the window becomes 375 px wide
      Then the week is shown in one row

    @backlog
    Scenario: The split applies to every size that has two rows
      Given the week is in two rows on tablets and desktops
      And the split is set to three days on top
      When I open the week of 2026-10-12 on a tablet
      Then Monday to Wednesday are on the top row
      And Thursday to Sunday are on the bottom row

  Rule: The spec puts both choices in Settings › Views (placement and labels open)

    @backlog
    Scenario: By default both sizes keep one row
      When I open the settings page "/settings/views"
      Then the "Week in two rows on phones" switch in the settings is off
      And the "Week in two rows on tablets and desktops" switch in the settings is off
      And the settings page does not show the setting "Days on the top row"

    @backlog
    Scenario: Each size has its own switch
      When I open the settings page "/settings/views"
      And I turn on "Week in two rows on tablets and desktops" in the settings
      Then the "Week in two rows on phones" switch in the settings is off
      When I open the week of 2026-10-12 on a tablet
      Then all seven days are laid out in two rows
      When I open the week of 2026-10-12 on a phone
      Then the seven days are side by side in a single row

    @backlog
    Scenario: The split row shows while either size has two rows
      Given the week is in two rows on phones
      When I open the settings page "/settings/views"
      Then the settings page shows the setting "Days on the top row"

    @backlog
    Scenario: The switches are no longer in Labs
      When I open the settings page "/settings/labs"
      Then the settings page does not show the setting "Week in two rows on phones"
      And the settings page does not show the setting "Week in two rows on tablets and desktops"

    @backlog
    Scenario: The settings search finds the switches in Views
      When I open the settings
      And I search the settings for "two rows"
      Then the settings search shows "Week in two rows on phones" in "Views"
      And the settings search shows "Week in two rows on tablets and desktops" in "Views"

  Rule: Whoever had the Labs switch on keeps two rows

    @backlog
    Scenario Outline: The old switch turns both sizes on
      Given the saved preferences still have the old two-row week overview on
      When I open the week of 2026-10-12 <size>
      Then all seven days are laid out in two rows

      Examples:
        | size         |
        | on a phone   |
        | on a tablet  |

    @backlog
    Scenario: A person who never turned it on stays on one row
      When I open the week of 2026-10-12 on a tablet
      Then the seven days are side by side in a single row
