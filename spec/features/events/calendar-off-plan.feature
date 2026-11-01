@calendars @calendar-off-plan @id:calendar-off-plan
Feature: A calendar that switches off by itself
  Owner, 2026-11-01: "from Friday 17:00 to Sunday 16:00 I don't want to see ANY work events in the calendar, meaning
  all are hidden, also the ones in the week."
  A calendar can switch off by itself. "Off" is exactly today's manual switch: while it is off, the calendar's events
  disappear from every view and every date, also next week's. Two kinds of plan, and both can be set at once:
  "Off at set times" is a time window that comes back every week (from a weekday and time to a weekday and time, e.g.
  Friday 17:00 to Sunday 16:00; "only Monday to Friday" is Saturday 00:00 to Monday 00:00), and "Off for a while" is
  off from now until 00:00 of a chosen day. The plan is set in a small sheet for the calendar: a long press on its
  chip in the filter bar, a long press on its row in the side menu, or its row under Settings › Calendars. A chip with
  a plan shows a small clock mark; while "Off for a while" it says when it comes back. The calendar switches at the
  window's edges while the app is open, and when the app is opened again. A tap still switches by hand; that holds
  until the plan's next switch, and a tap ends an "Off for a while". The plan belongs to the person, holds on every
  device, and the device applies it from its own copy, also without a connection. Times are the calendar's time zone.

  Background:
    Given the calendar is empty
    And today is 2026-11-04
    And the calendar contains an event "Standup" in the calendar "Work" on 2026-11-04 from 09:00 to 09:15
    And the calendar contains an event "Retro" in the calendar "Work" on 2026-11-06 from 15:00 to 16:00
    And the calendar contains an event "Planning" in the calendar "Work" on 2026-11-09 from 10:00 to 11:00
    And the calendar contains an event "Review" in the calendar "Work" on 2026-11-10 from 14:00 to 15:00
    And the calendar contains an event "Dentist" on 2026-11-07 from 09:00 to 10:00

  Rule: The sheet plans the switch

    @backlog
    Scenario: Off every weekend from Friday 17:00 to Sunday 16:00
      Given the time is 2026-11-06 18:00
      When I open the week view for 2026-11-09
      And I show the filters
      And I long-press the calendar chip "Work"
      And I choose "Off at set times" in the calendar sheet
      And I set the off time from "Fri" 17:00 to "Sun" 16:00 in the calendar sheet
      And I choose "Done" in the calendar sheet
      Then I do not see the event "Planning"
      And I do not see the event "Review"
      And the calendar chip "Work" is off
      And the calendar chip "Work" shows that it switches by itself

    @backlog
    Scenario: Off for a few days, back by itself at 00:00
      When I open the week view for 2026-11-02
      And I show the filters
      And I long-press the calendar chip "Work"
      And I choose "Off for a while" in the calendar sheet
      And I pick the date 2026-11-06 in the calendar sheet
      And I choose "Done" in the calendar sheet
      Then I do not see the event "Standup"
      And I see the event "Dentist" on 2026-11-07
      And the calendar chip "Work" is off
      And the calendar chip "Work" shows "Back Fri 6"
      When the time is 2026-11-06 00:00
      And I open the app again
      Then I see the event "Retro" on 2026-11-06
      And the calendar chip "Work" is on

    @backlog
    Scenario: Always on removes the plan
      Given the calendar "Work" is off every week from "Fri" 17:00 to "Sun" 16:00
      And the time is 2026-11-07 10:00
      When I open the week view for 2026-11-09
      And I show the filters
      And I long-press the calendar chip "Work"
      And I choose "Always on" in the calendar sheet
      And I choose "Done" in the calendar sheet
      Then I see the event "Planning" on 2026-11-09
      And the calendar chip "Work" does not show that it switches by itself

    @backlog
    Scenario: The calendar's row in the side menu opens the same sheet
      When I open the week view for 2026-11-02
      And I open the side menu
      And I long-press the calendar "Work" in the side menu
      And I choose "Off for a while" in the calendar sheet
      And I pick the date 2026-11-06 in the calendar sheet
      And I choose "Done" in the calendar sheet
      Then I do not see the event "Standup"

    @backlog
    Scenario: Settings › Calendars plans without a gesture
      When I open the settings
      And I open the plan of the calendar "Work" in the settings
      And I choose "Off at set times" in the calendar sheet
      And I set the off time from "Wed" 08:00 to "Wed" 20:00 in the calendar sheet
      And I choose "Done" in the calendar sheet
      And I open the week view for 2026-11-02
      Then I do not see the event "Standup"

  Rule: The plan switches the calendar like the manual switch, everywhere

    @backlog
    Scenario: During the weekend window the work calendar is off in every view
      Given the calendar "Work" is off every week from "Fri" 17:00 to "Sun" 16:00
      And the time is 2026-11-07 10:00
      When I open the month view for 2026-11
      Then I do not see the event "Review"
      And I see the event "Dentist" on 2026-11-07
      When I open the week view for 2026-11-09
      Then I do not see the event "Planning"
      When I open the day view for 2026-11-10
      Then I do not see the event "Review"

    @backlog
    Scenario: Back on at 16:00 on Sunday while the app is open
      Given the calendar "Work" is off every week from "Fri" 17:00 to "Sun" 16:00
      And the time is 2026-11-08 15:58 and the clock is running
      When I open the week view for 2026-11-09
      Then I do not see the event "Planning"
      When 3 minutes pass
      Then I see the event "Planning" on 2026-11-09

    @backlog
    Scenario: Off at 17:00 on Friday while the app is open
      Given the calendar "Work" is off every week from "Fri" 17:00 to "Sun" 16:00
      And the time is 2026-11-06 16:58 and the clock is running
      When I open the week view for 2026-11-02
      Then I see the event "Retro" on 2026-11-06
      When 3 minutes pass
      Then I do not see the event "Retro"

    @backlog
    Scenario: Back on when the app is opened after the window
      Given the calendar "Work" is off every week from "Fri" 17:00 to "Sun" 16:00
      And the time is 2026-11-07 10:00
      When I open the week view for 2026-11-09
      Then I do not see the event "Planning"
      When the time is 2026-11-08 16:00
      And I open the app again
      Then I see the event "Planning" on 2026-11-09

    @backlog
    Scenario: A tap still switches by hand until the plan's next switch
      Given the calendar "Work" is off every week from "Fri" 17:00 to "Sun" 16:00
      And the time is 2026-11-07 10:00
      When I open the week view for 2026-11-09
      And I show the filters
      And I tap the calendar chip "Work"
      Then I see the event "Planning" on 2026-11-09
      When the time is 2026-11-13 17:00
      And I open the app again
      Then I do not see the event "Planning"

    @backlog
    Scenario: Off for a while and the weekend window at once
      Given the calendar "Work" is off every week from "Fri" 17:00 to "Sun" 16:00
      And the calendar "Work" is off until 2026-11-10
      And the time is 2026-11-08 17:00
      When I open the week view for 2026-11-09
      And I show the filters
      Then I do not see the event "Planning"
      And the calendar chip "Work" shows "Back Tue 10"
      When the time is 2026-11-10 00:00
      And I open the app again
      Then I see the event "Planning" on 2026-11-09

    @backlog
    Scenario: A tap ends "Off for a while"
      Given the calendar "Work" is off until 2026-11-06
      When I open the week view for 2026-11-02
      And I show the filters
      And I tap the calendar chip "Work"
      Then I see the event "Standup" on 2026-11-04
      And the calendar chip "Work" does not show that it switches by itself

    @backlog
    Scenario: The plan holds on another device
      Given the calendar "Work" is off every week from "Fri" 17:00 to "Sun" 16:00
      And the time is 2026-11-07 10:00
      When I switch to another device
      And I open the week view for 2026-11-09
      Then I do not see the event "Planning"
