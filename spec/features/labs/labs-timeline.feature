@labs @timeline-view @id:labs-timeline
Feature: Labs: the timeline view
  The timeline view puts every event and task list on one continuous line across days, spaced by time, with a marker
  for now. It can be zoomed in and out. It spans many days, so the top bar names the view instead of a date and does
  not move through periods; its Today button brings the timeline back to now.

  Background:
    Given the calendar is empty
    And today is 2026-10-14
    And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00

  Scenario: The timeline puts everything on one line
    Given the time is 2026-10-14 08:00
    And the calendar contains an event "Gym" on 2026-10-15 from 18:00 to 19:00
    When I open the timeline view
    Then "Dentist" comes before "Gym" on the timeline
    And the now marker is before "Dentist" on the timeline
    And on the timeline "Gym" is farther from "Dentist" than "Dentist" is from the now marker

  Scenario: Longer events take more room on the timeline
    Given the calendar contains an event "Workshop" on 2026-10-14 from 13:00 to 16:00
    When I open the timeline view
    Then on the timeline "Workshop" is about 3 times as long as "Dentist"

  Scenario: All-day entries sit in their own band above the timeline
    Given the calendar contains an all-day event "Trip" on 2026-10-15
    When I open the timeline view
    Then "Trip" is in the all-day band above the timed entries

  Scenario: The timeline runs top to bottom and titles read normally
    Given the time is 2026-10-14 08:00
    When I open the timeline view
    Then the timeline runs from top to bottom
    And the title of "Dentist" on the timeline reads left to right in one line

  Scenario: The top bar names the timeline instead of a date
    When I open the timeline view
    Then the top bar names the view "Timeline"
    And the top bar shows no date

  Scenario: Overlapping entries sit side by side on the timeline
    Given the calendar contains an event "Review" on 2026-10-14 from 09:30 to 10:30
    When I open the timeline view
    Then on the timeline "Dentist" and "Review" are side by side

  # owner, 2026-11-01: "after scrolling a while there's no way back to today". The timeline gets the Today button of the
  # other views, same look and place; it brings now back to where the timeline opens (about a third from the top).
  # The timeline still has no date and no previous / next arrows.
  Rule: The Today button brings the timeline back to now

    Scenario: The top bar of the timeline has Today but no arrows
      When I open the timeline view
      Then the top bar names the view "Timeline"
      And the Today button is an icon with the label "Today"
      And the top bar shows no arrows

    Scenario Outline: After scrolling far away, Today goes back to now
      Given the time is 2026-10-14 08:00
      When I open the timeline view
      And I scroll the timeline <days> days <direction>
      Then I do not see the now marker
      And the Today button does not show that today is on screen
      When I go to today
      Then the now marker is visible on screen
      And "Dentist" is visible on the timeline
      And the Today button shows that today is on screen

      Examples:
        | days | direction |
        | 5    | ahead     |
        | 9    | back      |

    Scenario: The Today button lights up while now is on screen
      Given the time is 2026-10-14 08:00
      When I open the timeline view
      Then the Today button shows that today is on screen
