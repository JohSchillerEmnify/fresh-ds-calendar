@labs @runway @id:labs-bedtime-runway
Feature: Labs: the bedtime runway
  Experimental (Labs, off by default). The runway shows the rest of the day as one bar from now to tonight's bedtime
  that always fills the screen, so it shrinks as the evening goes on. Tonight's timed entries are drawn to scale in it
  and open on a tap; a line above it says how long until bed and how much of that is free. Without bedtime mode, or
  once bedtime has passed, a calm line says so instead.

  Background:
    Given the calendar is empty
    And today is 2026-10-14
    And the calendar contains an event "Call Mia" on 2026-10-14 from 15:00 to 16:00

  Scenario: The runway shows the evening until bedtime
    Given the time is 2026-10-14 14:00
    And bedtime mode is on with fixed times 22:30 and 07:00
    And the calendar contains a task list "Dinner" on 2026-10-14 at 19:00 for 60 minutes
    When I open the runway
    Then the runway reads "8 h 30 min until bed · 6 h 30 min free"
    And "Call Mia" is above "Dinner" on the runway
    When I tap "Call Mia" on the runway
    Then the event dialog is open

  Scenario: Entries are drawn to scale, short ones as long as the minimum
    Given the time is 2026-10-14 14:00
    And bedtime mode is on with fixed times 22:30 and 07:00
    And the minimum event length is 30 minutes
    And the calendar contains an event "Pills" on 2026-10-14 from 20:00 to 20:05
    When I open the runway
    Then on the runway "Call Mia" is about 2 times as tall as "Pills"
    And the runway reads "8 h 30 min until bed · 7 h free"

  Scenario: The runway shrinks as the evening goes on
    Given the time is 2026-10-14 14:00 and the clock is running
    And bedtime mode is on with fixed times 22:30 and 07:00
    When I open the runway
    And I note the height of "Call Mia" on the runway
    And 60 minutes pass
    Then the runway reads "7 h 30 min until bed · 6 h 30 min free"
    And "Call Mia" is taller on the runway than noted

  Scenario: Without bedtime mode the runway says how to switch it on
    Given the time is 2026-10-14 14:00
    When I open the runway
    Then the runway says "Bedtime is off — set it in the settings"

  Scenario: After bedtime the runway says when it was
    Given the time is 2026-10-14 23:30
    And bedtime mode is on with fixed times 23:00 and 07:00
    When I open the runway
    Then the runway says "Bedtime was at 23:00"

  Scenario: The runway is a Labs view, off by default
    When I open the week view for 2026-10-12
    And I turn on experimental views in the settings
    Then the view switcher does not offer "Until bedtime"
    When I switch the Labs view "Until bedtime" on in the settings
    Then the view switcher offers the experimental views "Until bedtime"
