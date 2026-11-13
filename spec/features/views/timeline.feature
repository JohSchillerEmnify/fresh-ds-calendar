@timeline @adhd @id:proportional-timeline
Feature: Seeing time: proportional timeline, now marker and time remaining
  Time blindness is a core ADHD difficulty. The day and week views are time-proportional
  (block height = duration), a "now" line moves live, and a Now card states in words how much time is
  left in the current event and until the next one, with a shrinking progress bar.
  "the clock is running" means the app clock advances; "N minutes pass" advances it deterministically.

  Background:
    Given the calendar is empty
    And the calendar contains an event "Dentist" on 2026-10-12 from 10:40 to 11:30
    And the calendar contains an event "Call" on 2026-10-12 from 13:00 to 13:30

  Scenario: Block height is proportional to duration
    Given today is 2026-10-12
    And the calendar contains an event "Workshop" on 2026-10-12 from 14:00 to 15:40
    When I open the day view for 2026-10-12
    Then the event "Workshop" is about 2 times as tall as the event "Dentist"

  # No minimum height: a card is never drawn past its real end, so equal durations look equal (owner, 2026-10-21)
  Scenario: Very short events are drawn at their real length
    Given today is 2026-10-12
    And the calendar contains an event "Pill" on 2026-10-12 from 08:00 to 08:05
    When I open the day view for 2026-10-12
    Then the event "Pill" is positioned from 08:00 to 08:05

  Scenario: The last of back-to-back short events is as tall as the others
    Given today is 2026-10-12
    And the calendar contains an event "Daily A" on 2026-10-12 from 15:00 to 15:30
    And the calendar contains an event "Daily B" on 2026-10-12 from 15:30 to 16:00
    And the calendar contains an event "Daily C" on 2026-10-12 from 16:00 to 16:30
    When I open the day view for 2026-10-12
    Then the event "Daily B" is positioned from 15:30 to 16:00
    And the event "Daily C" is positioned from 16:00 to 16:30

  Scenario: The phone month view opens the proportional day timeline, not an equal-height list
    Given today is 2026-10-12
    When I open the month view for 2026-10
    And I tap the day 2026-10-12 in the month view
    Then the day view is shown
    And the event "Dentist" is positioned from 10:40 to 11:30

  Scenario Outline: The now marker shows the current time and moves live
    Given the time is 2026-10-12 09:20 and the clock is running
    And the approaching track is off
    When I open the <view> view for 2026-10-12
    Then the now marker is positioned at 09:20
    And the now marker is in the column of 2026-10-12
    When 30 minutes pass
    Then the now marker is positioned at 09:50

    Examples:
      | view |
      | day  |
      | week |

  Scenario Outline: No now marker when today is not visible
    Given today is 2026-10-12
    When I open the <view> view for <period>
    Then I do not see the now marker

    Examples:
      | view  | period     |
      | day   | 2026-10-13 |
      | week  | 2026-10-19 |
      | month | 2026-10    |

  Scenario: Today's timeline scrolls to now
    Given the time is 2026-10-12 18:30
    When I open the day view for 2026-10-12
    Then the now marker is visible on screen

  Scenario: Other days scroll to the morning
    Given the time is 2026-10-12 18:30
    When I open the day view for 2026-10-13
    Then the time grid is scrolled to show 07:00 at the top

  # A side swipe in the day view keeps the hours in view (issue 145); the first opening keeps its start above
  @mobile
  Scenario: Swiping to the next day keeps the hours in view
    Given I am using a phone
    And today is 2026-10-12
    When I open the day view for 2026-11-16
    And I scroll the time grid to show 09:00 at the top
    And I start swiping left on the calendar by half the width
    Then the day 2026-11-17 beside the current one shows 09:00 at the top
    When I let go
    Then the URL path is "/day/2026-11-17"
    And the time grid is scrolled to show 09:00 at the top

  @mobile
  Scenario: Swiping back to the previous day keeps the hours in view
    Given I am using a phone
    And today is 2026-10-12
    When I open the day view for 2026-11-17
    And I scroll the time grid to show 08:00 at the top
    And I swipe right on the calendar
    Then the URL path is "/day/2026-11-16"
    And the time grid is scrolled to show 08:00 at the top

  Scenario: The Now card says how long until the next event
    Given the time is 2026-10-12 09:20 and the clock is running
    And the approaching track is off
    When I open the day view for 2026-10-12
    Then the now card shows the line "Next: Dentist in 1 h 20 min"
    And the now card does not show a current event

  Scenario: The Now card counts down the current event with a progress bar
    Given the time is 2026-10-12 09:20 and the clock is running
    And the approaching track is off
    And the time left in the Approaching card is on
    When I open the day view for 2026-10-12
    And 95 minutes pass
    Then the now card shows the line "Dentist · 35 min left"
    And the current event progress is 30 percent
    And the now card shows the line "Next: Call in 2 h 5 min"
    When 20 minutes pass
    Then the now card shows the line "Dentist · 15 min left"
    And the current event progress is 70 percent

  # owner, 2026-10-26: no "Nothing else today" card any more; the card goes when nothing is on or ahead (feature header-layout)
  Scenario Outline: The Approaching card is gone when nothing is on or ahead today
    Given the time is 2026-10-12 13:40
    And <track>
    When I open the <view> view for 2026-10-12
    Then I do not see the Approaching card

    Examples:
      | track                        | view |
      | the approach bar is on       | week |
      | the approaching track is off | week |
      | the approach bar is on       | day  |

  Scenario: The Approaching card goes when the last entry of the day ends
    Given the time is 2026-10-12 13:20 and the clock is running
    When I open the day view for 2026-10-12
    Then I see the Approaching card
    When 15 minutes pass
    Then I do not see the Approaching card

  Scenario Outline: The Now card is shown in the month and year views of today and in another week
    Given the time is 2026-10-12 09:20
    And the approaching track is off
    And the calendar contains an event "Dentist" on 2026-10-12 from 10:40 to 11:00
    When I open the <view> view for <period>
    Then the now card shows the line "Next: Dentist in 1 h 20 min"

    Examples:
      | view  | period     |
      | month | 2026-10    |
      | year  | 2026       |
      | week  | 2026-10-19 |

  Scenario: Switching views keeps the Now card in place
    Given the time is 2026-10-12 09:20
    And the approaching track is off
    When I open the week view for 2026-10-12
    And I switch to the month view
    Then the now card stayed in place
