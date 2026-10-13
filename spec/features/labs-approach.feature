@approach @id:labs-approach-bar
Feature: The Approaching card and its track
  The card above every calendar view is called Approaching (owner, 2026-10-13). It is always compact (a slim card) and can be
  switched off entirely in the settings. Its track is on by default (it can be turned off, then the card shows the
  "Next:" line instead): "now" at its start and a fixed time window ahead (3, 6 or 12 hours or any whole number of hours from 1
  to 24, chosen in the settings, 3 by default), marked with times that thin out as the window grows. Every entry with a time today (events and task lists
  with a time) within the window sits on it as small chips at their start time and move towards "now"
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

  Scenario: Everything within the window is shown, not only the next three
    Given the time is 2026-10-14 08:00
    And the calendar contains a task list "Groceries" on 2026-10-14 at 10:00 with items:
      | Milk |
    And the calendar contains an event "Gym" on 2026-10-14 from 11:00 to 12:00
    And the calendar contains an event "Lunch" on 2026-10-14 from 12:30 to 13:00
    And the approach bar is on with a window of 6 hours
    When I open the week view for 2026-10-12
    Then the approach bar shows 4 entries
