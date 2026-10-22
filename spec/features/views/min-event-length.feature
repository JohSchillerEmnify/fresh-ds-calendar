@timeline @adhd @id:min-event-length
Feature: Minimum event length for readability
  By default every entry in the day and week views is drawn exactly as long as it lasts, so a very short one is thin
  and its title may not fit (owner, 2026-10-21). For readability, the owner can set a minimum length in the settings:
  Off (the default), 15 or 30 minutes. With a minimum set, a shorter event or task list is treated as lasting that
  long everywhere it is laid out in time, the Labs views and the phone widget included: as tall as that, and
  overlapping whatever starts within it, so equal entries always look equal. Its real times never change.

  Background:
    Given the calendar is empty
    And today is 2026-10-12

  Rule: A short entry is laid out as long as the minimum

    Scenario: A short event is drawn as long as the minimum
      Given the minimum event length is 30 minutes
      And the calendar contains an event "Pill" on 2026-10-12 from 08:00 to 08:05
      When I open the day view for 2026-10-12
      Then the event "Pill" is positioned from 08:00 to 08:30

    Scenario: An entry already longer than the minimum keeps its real length
      Given the minimum event length is 15 minutes
      And the calendar contains an event "Call" on 2026-10-12 from 13:00 to 13:20
      When I open the day view for 2026-10-12
      Then the event "Call" is positioned from 13:00 to 13:20

    Scenario: A short task list counts as long as the minimum too
      Given the minimum event length is 30 minutes
      And the calendar contains a task list "Meds" on 2026-10-12 at 08:00 for 10 minutes
      And the calendar contains an event "Breakfast" on 2026-10-12 from 08:15 to 08:45
      When I open the day view for 2026-10-12
      Then the task list "Meds" and the event "Breakfast" are laid out as overlapping

    Scenario Outline: Back-to-back short events count as overlapping in every view that lays out time
      Given the minimum event length is 30 minutes
      And the calendar contains an event "Daily A" on 2026-10-12 from 11:00 to 11:15
      And the calendar contains an event "Daily B" on 2026-10-12 from 11:15 to 11:30
      When I look at 2026-10-12 in the <view>
      Then the events "Daily A" and "Daily B" are laid out as overlapping

      Examples:
        | view                  |
        | day view              |
        | week view             |
        | two-row week overview |
        | Labs strip            |
        | Labs timeline         |
        | zoom month            |
        | Labs horizontal view  |

      # The phone widget is native Android: Playwright cannot drive it, so its layout is proven by the widget's JUnit tests.
      @backlog
      Examples: phone widget
        | view         |
        | phone widget |

    Scenario: While being shortened, an event already shows the minimum length it will get
      Given the minimum event length is 30 minutes
      And the calendar contains an event "Focus" on 2026-10-12 from 09:00 to 10:00
      And the event "Focus" shows resize handles in the day view for 2026-10-12
      When I hold the end handle of "Focus" at 09:15
      Then the event "Focus" is positioned from 09:00 to 09:30

    Scenario: Choosing a minimum in the settings changes the calendar right away
      Given the calendar contains an event "Pill" on 2026-10-12 from 08:00 to 08:05
      And I am on the settings screen
      When I choose a minimum event length of 30 minutes
      Then the event "Pill" is positioned from 08:00 to 08:30 in the day view for 2026-10-12

  Rule: The minimum never changes an entry's real times

    Scenario: A short event drawn at the minimum shows its real time
      Given the minimum event length is 30 minutes
      And the calendar contains an event "Pill" on 2026-10-12 from 08:00 to 08:05
      When I open the day view for 2026-10-12
      Then opening the event "Pill" shows the time "08:00–08:05"

    Scenario: Shortening an event below the minimum keeps the end it was given
      Given the minimum event length is 30 minutes
      And the calendar contains an event "Focus" on 2026-10-12 from 09:00 to 10:00
      And the event "Focus" shows resize handles in the day view for 2026-10-12
      When I drag the end handle of "Focus" to 09:15 in the day view
      Then opening the event "Focus" shows the time "09:00–09:15"
