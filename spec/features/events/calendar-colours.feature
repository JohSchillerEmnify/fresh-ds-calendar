@calendars @calendar-colours @id:calendar-colours
Feature: A colour for every calendar
  Owner, 2026-11-09: "The calendar colors are no longer adjustable in the calendar menu. You should be able to adjust
  all the calendar colors." Then: the colour belongs on the calendar's own settings page, not in its plan; it shows the
  colour the calendar has now alongside the others; the colours come from Google; and there is a custom colour, with a
  colour picker (typing a hex value is only an extra).
  The Color row of a calendar's settings page (Settings › Calendars › the calendar) offers Google's 24 calendar colours
  (the palette of Google's Colors API, kept on the device once fetched, a built-in copy of the same 24 until then) for
  EVERY calendar in the person's list: their own, the ones shared with them, and read-only ones. The colour the calendar
  has now is always chosen: a palette colour is marked, any other colour (a custom one, or the 11 event colours Google
  gave a new calendar) is shown as one extra "Current color" swatch in front of the palette, marked. A colour picker
  ("Custom") and a field for a hex value (`#1a73e8`, checked like the theme's seed colour) set any other colour. A
  palette colour and a custom one both go to Google as the person's calendar list `backgroundColor` and
  `foregroundColor` (Google's own colour on the list supersedes a bare `colorId`) (Google keeps the list colour per person, also for calendars the person cannot edit). Picking one
  recolours the calendar's events at once on this device and it holds on every device. Events that have a colour of
  their own keep it.

  Background:
    Given today is 2026-10-12
    And "jo@example.com" and "anna@example.com" may use the calendar
    And "jo@example.com" has the calendar "Jo" and the shared calendar "Family"
    And the calendar "Jo" has an event "Dentist" on 2026-10-13 from 09:00 to 10:00
    And the calendar "Jo" has an event "Checkup" on 2026-10-13 from 11:00 to 12:00 in the colour "Tomato"
    And the calendar "Family" has an event "Dinner" on 2026-10-14 from 19:00 to 21:00
    And "jo@example.com" is signed in

  Scenario: The settings page offers Google's calendar colours
    When I open the settings
    And I open the settings group "Calendars"
    And I open the calendar "Jo" in the settings
    Then the settings page shows the setting "Color"
    And the calendar's settings page offers 24 palette colours
    And the palette colour 1 is drawn as "#ac725e"
    And the palette colour 16 is drawn as "#4986e7"

  Scenario: A colour outside the palette is shown as chosen, alongside the palette
    When I open the settings
    And I open the settings group "Calendars"
    And I open the calendar "Jo" in the settings
    Then the current colour "#039be5" is chosen as an extra colour on the calendar's settings page
    And the calendar's settings page offers 24 palette colours

  Scenario: A palette colour is marked as chosen
    Given I recolour the calendar "Jo" to the palette colour 16
    Then the palette colour 16 is chosen on the calendar's settings page
    And the calendar's settings page has no extra current colour

  Scenario: Picking a palette colour recolours the events at once
    When I open the settings
    And I open the settings group "Calendars"
    And I open the calendar "Jo" in the settings
    And I choose the palette colour 8 on the calendar's settings page
    Then the palette colour 8 is chosen on the calendar's settings page
    When I leave the settings
    Then the event "Dentist" is drawn in the colour "#16a765"
    And the event "Dinner" is drawn in its own calendar colour

  Scenario: A calendar shared read-only can be recoloured too
    When I open the settings
    And I open the settings group "Calendars"
    And I open the calendar "Family" in the settings
    And I choose the palette colour 3 on the calendar's settings page
    And I leave the settings
    Then the event "Dinner" is drawn in the colour "#f83a22"

  Scenario: A palette colour goes to Google as that colour, replacing the one Google holds
    When I open the settings
    And I open the settings group "Calendars"
    And I open the calendar "Family" in the settings
    And I choose the palette colour 3 on the calendar's settings page
    Then Google lists the calendar "Family" with the palette colour 3
    And Google lists the calendar "Jo" in the colour "#039be5"

  Scenario: A colour from the colour picker recolours the calendar and goes to Google as RGB
    When I open the settings
    And I open the settings group "Calendars"
    And I open the calendar "Jo" in the settings
    And I pick the custom colour "#123456" on the calendar's settings page
    Then the current colour "#123456" is chosen as an extra colour on the calendar's settings page
    And Google lists the calendar "Jo" in the colour "#123456"
    When I leave the settings
    Then the event "Dentist" is drawn in the colour "#123456"

  Scenario: A typed hex colour works like the colour picker
    When I open the settings
    And I open the settings group "Calendars"
    And I open the calendar "Jo" in the settings
    And I type the colour "#0b8043" on the calendar's settings page
    Then the current colour "#0b8043" is chosen as an extra colour on the calendar's settings page
    And Google lists the calendar "Jo" in the colour "#0b8043"

  Scenario: A typed colour that is no hex value is refused
    When I open the settings
    And I open the settings group "Calendars"
    And I open the calendar "Jo" in the settings
    And I type the colour "blue" on the calendar's settings page
    Then the colour field shows the error "Enter a color like #1a73e8"
    And Google lists the calendar "Jo" in the colour "#039be5"

  Scenario: The colour holds after opening the app again
    Given I recolour the calendar "Jo" to the palette colour 8
    When I leave the settings
    And I open the app again
    Then the event "Dentist" is drawn in the colour "#16a765"

  Scenario: The colour holds on another device
    Given I recolour the calendar "Jo" to the palette colour 8
    When "jo@example.com" opens the week view for 2026-10-12 on another device
    Then the event "Dentist" is drawn in the colour "#16a765"

  Scenario: An event with a colour of its own keeps it
    Given I recolour the calendar "Jo" to the palette colour 8
    When I leave the settings
    Then the event "Dentist" is drawn in the colour "#16a765"
    And the event "Checkup" is drawn in the colour "Tomato"
