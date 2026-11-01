@calendars @calendar-off-plan @id:calendar-off-plan
Feature: A calendar that switches off by itself
  Owner, 2026-11-01: "e.g. work calendar only Mon–Fri; hide a calendar for a few days, back by itself. 'Off' = today's
  manual switch, just automatic. Long press on the chip."
  A tap on a calendar chip in the filter bar still switches the calendar on or off. A long press on the chip opens a
  small sheet for that calendar with three choices: "Always on" (no plan, the default), "Off for a while" (off now and
  back on by itself on a chosen day) and "Only on some days" (on, on the chosen weekdays, off on the others). "Off"
  is exactly today's manual switch: the calendar's events and task lists disappear from every view and every date
  while it is off. The day that counts is today on the app clock, so on a Saturday a "Mon–Fri" work calendar is off
  everywhere, also in next week's days. The calendar switches at the start of the day (00:00). A chip with a plan
  shows a small clock mark; while "Off for a while" it says when it comes back. A tap on the chip still switches by
  hand; that holds until the plan's next switch (an "Off for a while" ends with the tap). The plan belongs to the
  person and holds on every device, and the device applies it from its own copy, also without a connection.

  Background:
    Given the calendar is empty
    And today is 2026-11-04
    And the calendar contains an event "Standup" in the calendar "Work" on 2026-11-04 from 09:00 to 09:15
    And the calendar contains an event "Retro" in the calendar "Work" on 2026-11-06 from 15:00 to 16:00
    And the calendar contains an event "Planning" in the calendar "Work" on 2026-11-09 from 10:00 to 11:00
    And the calendar contains an event "Dentist" on 2026-11-07 from 09:00 to 10:00

  Rule: A long press on the chip plans the switch

    @backlog
    Scenario: Off for a few days, back by itself
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
      When today is 2026-11-06
      And I open the app again
      Then I see the event "Retro" on 2026-11-06
      And the calendar chip "Work" is on

    @backlog
    Scenario: Work only from Monday to Friday
      When I open the week view for 2026-11-02
      And I show the filters
      And I long-press the calendar chip "Work"
      And I choose "Only on some days" in the calendar sheet
      And I pick the days "Mon Tue Wed Thu Fri" in the calendar sheet
      And I choose "Done" in the calendar sheet
      Then I see the event "Standup" on 2026-11-04
      And the calendar chip "Work" is on
      And the calendar chip "Work" shows that it switches by itself

    @backlog
    Scenario: Always on removes the plan
      Given the calendar "Work" is on only on "Mon Tue Wed Thu Fri"
      And today is 2026-11-07
      When I open the week view for 2026-11-09
      And I show the filters
      And I long-press the calendar chip "Work"
      And I choose "Always on" in the calendar sheet
      And I choose "Done" in the calendar sheet
      Then I see the event "Planning" on 2026-11-09
      And the calendar chip "Work" does not show that it switches by itself

  Rule: The plan switches the calendar like the manual switch

    @backlog
    Scenario: On the weekend the work calendar is off everywhere, on Monday it is back
      Given the calendar "Work" is on only on "Mon Tue Wed Thu Fri"
      And today is 2026-11-07
      When I open the week view for 2026-11-09
      And I show the filters
      Then I do not see the event "Planning"
      And the calendar chip "Work" is off
      When today is 2026-11-09
      And I open the app again
      Then I see the event "Planning" on 2026-11-09
      And the calendar chip "Work" is on

    @backlog
    Scenario: A tap still switches by hand until the plan's next switch
      Given the calendar "Work" is on only on "Mon Tue Wed Thu Fri"
      And today is 2026-11-07
      When I open the week view for 2026-11-02
      And I show the filters
      And I tap the calendar chip "Work"
      Then I see the event "Retro" on 2026-11-06
      When today is 2026-11-14
      And I open the week view for 2026-11-09
      Then I do not see the event "Planning"

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
      Given the calendar "Work" is on only on "Mon Tue Wed Thu Fri"
      And today is 2026-11-07
      When I switch to another device
      And I open the week view for 2026-11-09
      Then I do not see the event "Planning"
