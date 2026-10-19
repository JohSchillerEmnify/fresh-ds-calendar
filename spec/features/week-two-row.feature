@week @two-row @id:two-row-week
Feature: Two-row week overview
  On a narrow screen the week's seven day columns are too thin to read. Turned on, the week
  is laid out in two rows so the whole week — every day and its entries to scale — is visible
  at once without scrolling. It is an experimental setting, off by default, and also changes
  the week on wider screens.

  Background:
    Given the calendar is empty
    And the expanding task-list cards experiment is on
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
