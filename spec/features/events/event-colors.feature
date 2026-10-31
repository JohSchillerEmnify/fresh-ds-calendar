@events @colors @id:event-colors
Feature: Event colors
  An event uses its calendar color unless one of the 11 Google event colors is chosen:
  Lavender #7986cb (1), Sage #33b679 (2), Grape #8e24aa (3), Flamingo #e67c73 (4),
  Banana #f6bf26 (5), Tangerine #f4511e (6), Peacock #039be5 (7), Graphite #616161 (8),
  Blueberry #3f51b5 (9), Basil #0b8043 (10), Tomato #d50000 (11).

  Background:
    Given the calendar is empty
    And today is 2026-10-12

  Scenario: Create an event with a color
    When I open the week view for 2026-10-12
    And I start creating an event
    And I fill in the event form with:
      | title      | Birthday   |
      | start date | 2026-10-14 |
      | start time | 18:00      |
      | end time   | 21:00      |
      | color      | Tomato     |
    And I save the event
    Then the event "Birthday" has the color "#d50000"
    And the Google event "Birthday" has:
      | colorId | 11 |

  Scenario: New events use the calendar color
    When I open the week view for 2026-10-12
    And I start creating an event
    Then the event form shows:
      | color | Calendar color |

  Scenario: The calendar color swatch shows the chosen calendar's color
    When I open the week view for 2026-10-12
    And I start creating an event
    Then the calendar color swatch is "#039be5"
    When I fill in the event form with:
      | calendar | Work |
    Then the calendar color swatch is "#0b8043"
    And the event form shows:
      | color | Calendar color |

  Scenario: Choosing a calendar makes the new event's color that calendar's color
    When I open the week view for 2026-10-12
    And I start creating an event
    And I fill in the event form with:
      | title      | Standup    |
      | start date | 2026-10-14 |
      | start time | 09:00      |
      | end time   | 09:15      |
      | calendar   | Work       |
    And I save the event
    Then the event "Standup" has the color "#0b8043"
    And the Google event "Standup" has no color ID

  Scenario: A color picked explicitly stays when the calendar is chosen
    When I open the week view for 2026-10-12
    And I start creating an event
    And I fill in the event form with:
      | title      | Standup    |
      | start date | 2026-10-14 |
      | start time | 09:00      |
      | end time   | 09:15      |
      | color      | Tomato     |
      | calendar   | Work       |
    And I save the event
    Then the event "Standup" has the color "#d50000"
    And the Google event "Standup" has:
      | colorId | 11 |

  Scenario: Change the color of an existing event and reset it
    Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    When I open the week view for 2026-10-12
    And I open the event "Dentist"
    And I fill in the event form with:
      | color | Basil |
    And I save the event
    Then the event "Dentist" has the color "#0b8043"
    When I open the event "Dentist"
    Then the event form shows:
      | color | Basil |
    When I fill in the event form with:
      | color | Calendar color |
    And I save the event
    Then the event "Dentist" has the color "#039be5"
    And the Google event "Dentist" has no color ID

  @sync
  Scenario: A color set in Google is shown in the app
    Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    When I open the week view for 2026-10-12
    And Google sets the color ID of the event "Dentist" to "5"
    And I reload the page
    Then the event "Dentist" has the color "#f6bf26"

  Scenario: The event color picker shows all Google colors
    When I open the week view for 2026-10-12
    And I start creating an event
    Then the event color options are "Calendar color, Tomato, Flamingo, Tangerine, Banana, Sage, Basil, Peacock, Blueberry, Lavender, Grape, Graphite"
