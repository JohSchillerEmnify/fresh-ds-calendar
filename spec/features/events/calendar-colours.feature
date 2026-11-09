@calendars @calendar-colours @id:calendar-colours
Feature: A colour for every calendar
  Owner, 2026-11-09: "The calendar colors are no longer adjustable in the calendar menu. You should be able to adjust
  all the calendar colors."
  The calendar sheet (long press on a calendar's chip in the filter bar or its row in the side menu, or its row under
  Settings › Calendars) offers the 11 Google colours of the event dialog for EVERY calendar in the person's list: their
  own, the ones shared with them, and read-only ones. The chosen colour is shown as selected. Picking one recolours the
  calendar's events at once on this device, it holds on every device, and it goes to Google as that person's calendar
  list colour (Google keeps it per person, also for calendars the person cannot edit). Events that have a colour of
  their own keep it.

  Background:
    Given today is 2026-10-12
    And "jo@example.com" and "anna@example.com" may use the calendar
    And "jo@example.com" has the calendar "Jo" and the shared calendar "Family"
    And the calendar "Jo" has an event "Dentist" on 2026-10-13 from 09:00 to 10:00
    And the calendar "Jo" has an event "Checkup" on 2026-10-13 from 11:00 to 12:00 in the colour "Tomato"
    And the calendar "Family" has an event "Dinner" on 2026-10-14 from 19:00 to 21:00
    And "jo@example.com" is signed in

  Scenario: The sheet shows the calendar's colour as chosen
    When I show the filters
    And I long-press the calendar chip "Jo"
    Then the calendar sheet offers 11 colours
    And the colour "Peacock" is chosen in the calendar sheet

  Scenario: Picking a colour recolours the events at once
    When I show the filters
    And I long-press the calendar chip "Jo"
    And I choose the colour "Basil" in the calendar sheet
    Then the colour "Basil" is chosen in the calendar sheet
    And the event "Dentist" is drawn in the colour "Basil"
    And the event "Dinner" is drawn in its own calendar colour

  Scenario: A calendar shared read-only can be recoloured too
    When I show the filters
    And I long-press the calendar chip "Family"
    And I choose the colour "Grape" in the calendar sheet
    Then the event "Dinner" is drawn in the colour "Grape"

  Scenario: The colour goes to Google as the person's list colour
    When I show the filters
    And I long-press the calendar chip "Family"
    And I choose the colour "Grape" in the calendar sheet
    Then Google lists the calendar "Family" in the colour "Grape"
    And Google lists the calendar "Jo" in the colour "Peacock"

  Scenario: The colour holds after opening the app again
    Given I recolour the calendar "Jo" to "Basil"
    When I open the app again
    Then the event "Dentist" is drawn in the colour "Basil"

  Scenario: The colour holds on another device
    Given I recolour the calendar "Jo" to "Basil"
    When "jo@example.com" opens the week view for 2026-10-12 on another device
    Then the event "Dentist" is drawn in the colour "Basil"

  Scenario: An event with a colour of its own keeps it
    When I recolour the calendar "Jo" to "Basil"
    Then the event "Dentist" is drawn in the colour "Basil"
    And the event "Checkup" is drawn in the colour "Tomato"
