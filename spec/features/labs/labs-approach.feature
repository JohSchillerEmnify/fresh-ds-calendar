@approach @id:labs-approach-bar
Feature: The Approaching card and its track
  The card above every calendar view is called Approaching (owner, 2026-10-13). It is always compact (a slim card) and can be
  switched off entirely in the settings. It is only there while something is on or ahead today: with nothing running,
  nothing timed still to come today and no night on its track, it is gone (0 px; owner, 2026-10-26, it replaces the
  "Nothing else today" card). Its "Sprint Planning · 30 min left" line and the progress bar under the track have their own switch ("Time left", off by default:
  the slim track is enough). With the track on and the time left off, the card shows neither the line nor the progress bar, since the
  track already shows the running entry; with the track off it keeps the running entry's title as its line. A long title never pushes the
  time left out of the line.
  Whenever the card does not show the time left (the card or its time-left line switched off), the running entry
  shows it on its own time line instead ("09:00–10:00 · 30 min left"; on the running entry the time left takes the
  place of the duration), in the day and week views (owner, 2026-10-26: "it should be visible from the chip"). Its track is on by default (it can be turned off, then the card shows the
  "Next:" line instead): "now" at its start and a fixed time window ahead (3, 6 or 12 hours or any whole number of hours from 1
  to 24, chosen in the settings, 3 by default), marked with times that thin out as the window grows. Every entry with a time today (events and task lists
  with a time, but not a list carried over from an earlier day: it is untimed today) within the window sits on it as small chips at their start time and move towards "now"
  as time passes. When nothing is within the window, the next entry waits at the end of the track. No "Next:" text
  is shown while the track is on; the other lines of the now card stay as they are.

  Background:
    Given the calendar is empty
    And today is 2026-10-14
    And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00

  Scenario: The approach bar shows the entries within the window
    Given the time is 2026-10-14 08:00
    And the calendar contains a task list "Groceries" on 2026-10-14 at 10:00 with items:
      | Milk |
    And the calendar contains an event "Gym" on 2026-10-14 from 11:00 to 12:00
    And the calendar contains an event "Lunch" on 2026-10-14 from 12:30 to 13:00
    When I turn on the approach bar and open the week view for 2026-10-12
    Then the approach bar shows "Dentist", "Groceries" and "Gym" in this order

  Scenario: The next entry comes closer as time passes
    Given the time is 2026-10-14 08:00
    And the approach bar is on
    And the calendar contains an event "Gym" on 2026-10-14 from 11:00 to 12:00
    When I open the week view for 2026-10-12
    Then the approach bar shows "Dentist" in 60 minutes
    When the time is 2026-10-14 08:45
    Then "Dentist" is closer to now on the approach bar

  Scenario: An entry beyond the window waits at the end of the track
    Given the time is 2026-10-14 05:00
    And the approach bar is on
    When I open the week view for 2026-10-12
    Then the approach bar shows "Dentist" at its end

  Scenario: A longer window reaches further ahead
    Given the time is 2026-10-14 08:00
    And the calendar contains an event "Lunch" on 2026-10-14 from 12:30 to 13:00
    And the approach bar is on with a window of 6 hours
    When I open the week view for 2026-10-12
    Then the approach bar shows "Dentist" and "Lunch"

  Scenario: Entries take only the room of their duration
    Given the time is 2026-10-14 08:00
    And the calendar contains an event "Call" on 2026-10-14 from 08:30 to 08:45
    And the approach bar is on with a window of 12 hours
    When I open the week view for 2026-10-12
    Then on the approach bar "Dentist" is 4 times as long as "Call"
    And the title of "Call" is shown next to its block

  Scenario: A running entry slides out to the left
    Given the time is 2026-10-14 09:15
    And the approach bar is on
    When I open the week view for 2026-10-12
    Then on the approach bar "Dentist" starts at now and shows 45 minutes
    When the time is 2026-10-14 09:45
    Then on the approach bar "Dentist" starts at now and shows 15 minutes

  Scenario: The track is there without changing any setting
    Given the time is 2026-10-14 08:00
    When I open the week view for 2026-10-12
    Then the approach bar shows "Dentist" in 60 minutes

  Scenario: A window of my own number of hours
    Given the time is 2026-10-14 08:00
    And the calendar contains an event "Lunch" on 2026-10-14 from 12:30 to 13:00
    When I set the approaching window to 5 hours in the settings
    And I open the week view for 2026-10-12
    Then the approach bar shows "Dentist" and "Lunch"

  Scenario: The Approaching card can be switched off
    When I switch off the Approaching card in the settings
    And I open the week view for 2026-10-12
    Then I do not see the Approaching card

  Scenario Outline: With the Approaching card off the running entry shows the time left
    Given the time is 2026-10-14 09:30 and the clock is running
    And the Approaching card is off
    When I open the <view> view for <period>
    Then the event "Dentist" shows "30 min left" after its time
    When 5 minutes pass
    Then the event "Dentist" shows "25 min left" after its time

    Examples:
      | view | period     |
      | day  | 2026-10-14 |

    # A phone's week column may have no time line on a 1 h block (open point Q9).
    @desktop
    Examples: desktop week
      | view | period     |
      | week | 2026-10-12 |

  Scenario: With the Approaching card on the running entry does not repeat the time left
    Given the time is 2026-10-14 09:30
    And the time left in the Approaching card is on
    When I open the day view for 2026-10-14
    Then the now card shows the line "Dentist · 30 min left"
    And the event "Dentist" shows no time left

  Scenario: Switching off the time left moves it from the card onto the running entry
    Given the time is 2026-10-14 09:30
    And the time left in the Approaching card is on
    When I switch off the time left in the Approaching card in the settings
    And I open the day view for 2026-10-14
    Then the now card shows no line and no progress bar
    And the event "Dentist" shows "30 min left" after its time

  Scenario: By default the card shows only its track
    Given the time is 2026-10-14 09:30
    When I open the day view for 2026-10-14
    Then the now card shows no line and no progress bar
    And the event "Dentist" shows "30 min left" after its time

  Scenario: With the track off the card keeps the running entry's title
    Given the time is 2026-10-14 09:30
    And the approach bar is off
    When I open the day view for 2026-10-14
    Then the now card shows the line "Dentist"

  Scenario: An entry that is not running shows no time left
    Given the time is 2026-10-14 08:00
    And the Approaching card is off
    When I open the day view for 2026-10-14
    Then the event "Dentist" shows no time left

  Scenario: Everything within the window is shown, not only the next three
    Given the time is 2026-10-14 08:00
    And the calendar contains a task list "Groceries" on 2026-10-14 at 10:00 with items:
      | Milk |
    And the calendar contains an event "Gym" on 2026-10-14 from 11:00 to 12:00
    And the calendar contains an event "Lunch" on 2026-10-14 from 12:30 to 13:00
    And the approach bar is on with a window of 6 hours
    When I open the week view for 2026-10-12
    Then the approach bar shows 4 entries

  # owner, 2026-11-01: a list carried forward to today is untimed today, so it is not on the track
  Scenario: A task list carried over from yesterday is not on the track
    Given the time is 2026-10-14 08:00
    And the calendar contains a task list "Laundry" on 2026-10-13 at 09:30 with items:
      | Wash |
    And the calendar contains an event "Gym" on 2026-10-14 from 11:00 to 12:00
    And the calendar contains an event "Lunch" on 2026-10-14 from 12:30 to 13:00
    And the approach bar is on with a window of 6 hours
    When I open the day view for 2026-10-14
    Then the approach bar shows "Dentist", "Gym" and "Lunch" in this order

  Scenario: Overlapping entries take at most two rows
    Given the calendar contains an event "Call" on 2026-10-14 from 09:00 to 09:30
    And the calendar contains an event "Pills" on 2026-10-14 from 09:00 to 09:15
    When I open the week view for 2026-10-12
    Then the approach bar shows its entries in 2 rows

  Scenario: Pop-ups from the top bar stay above every bar of the Approaching track
    Given the time is 2026-10-14 08:00
    And the approach bar is on with a window of 6 hours
    And the calendar contains an event "Call" on 2026-10-14 from 08:30 to 08:45
    And the calendar contains an event "Pills" on 2026-10-14 from 08:30 to 08:40
    And the calendar contains an event "Gym" on 2026-10-14 from 11:00 to 12:00
    And the calendar contains an event "Lunch" on 2026-10-14 from 12:30 to 13:00
    And the calendar contains an event "Dinner" on 2026-10-14 from 13:30 to 14:00
    When I open the week view for 2026-10-12
    And I open the month picker
    Then no bar of the approach track lies on top of the month picker

  Scenario: Back-to-back entries in two lanes keep every title readable
    Given the time is 2026-10-14 10:00
    And the approach bar is on
    And the calendar contains an event "Bachata Sensual" on 2026-10-14 from 10:20 to 11:20
    And the calendar contains an event "Pauke Retournieren" on 2026-10-14 from 10:25 to 10:55
    And the calendar contains an event "Hellbreakers" on 2026-10-14 from 11:05 to 12:05
    And the calendar contains an event "HipHop" on 2026-10-14 from 11:20 to 12:20
    When I open the week view for 2026-10-12
    Then the approach bar shows its entries in 2 rows
    And on the approach bar no title is covered by another bar

  Scenario: An entry never covers another entry's block while a title can give way
    Given the time is 2026-10-14 10:00
    And the approach bar is on
    And the calendar contains an event "Physiotherapy appointment" on 2026-10-14 from 10:10 to 10:15
    And the calendar contains an event "Swim" on 2026-10-14 from 10:20 to 11:20
    And the calendar contains an event "Choir" on 2026-10-14 from 10:25 to 10:55
    When I open the week view for 2026-10-12
    Then the approach bar shows its entries in 2 rows
    And on the approach bar no title is covered by another bar
