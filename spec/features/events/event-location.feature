@events @location @id:event-location
Feature: Places for an event's location
  While the location of an event is typed, matching places from OpenStreetMap are suggested (owner, board item g6:
  "Location: address suggestions + small map", Photon for the suggestions, an OpenStreetMap map, no API key). Picking
  one fills the field with the place's name and address and shows a small map with a pin under the field; the map
  carries the OpenStreetMap credit. Typing stays plain text: a location that is not picked is kept exactly as typed and
  shows no map.
  The place search and the map pictures are asked through the app's own server, never by the device directly, so the
  place search sees only the typed text, not who asks (proposed, see the open questions). Only the typed text (at least
  3 characters, after a short pause) and the app's language are sent.
  The picked place's position is stored with the event (in Google, next to the location text, which stays readable in
  Google Calendar), so the map shows again on every device without a new search.
  Like everything else, the location and the place's position are kept on the device (ADR 0025): without a connection
  the field is plain text and nothing is suggested; the map shows from the pictures the device has already seen, and
  otherwise a placeholder with the pin and the place's name.
  Tapping an event opens its sheet (there is no separate details page), so the map lives in that sheet under the
  location field, and in the read-only sheet of events that cannot be edited.

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And the place search knows:
      | name                     | address                          | latitude | longitude |
      | Zahnarztpraxis Dr. Weber | Hauptstraße 12, 10827 Berlin     | 52.4867  | 13.3536   |
      | Zahnklinik Mitte         | Friedrichstraße 90, 10117 Berlin | 52.5200  | 13.3880   |
      | Stadtbad Neukölln        | Ganghoferstraße 3, 12043 Berlin  | 52.4797  | 13.4361   |

  Rule: Typing a location suggests places; a picked place fills the field and shows a small map

    @backlog
    Scenario: Typing a location suggests matching places
      When I open the week view for 2026-10-12
      And I start creating an event
      And I type "Zahn" in the event field "location"
      Then I see the place suggestions:
        | name                     | address                          |
        | Zahnarztpraxis Dr. Weber | Hauptstraße 12, 10827 Berlin     |
        | Zahnklinik Mitte         | Friedrichstraße 90, 10117 Berlin |
      And the suggestions credit OpenStreetMap

    @backlog
    Scenario: Fewer than three characters suggest nothing
      When I open the week view for 2026-10-12
      And I start creating an event
      And I type "Za" in the event field "location"
      Then I see no place suggestions

    @backlog
    Scenario: Picking a place fills the location and shows a small map
      When I open the week view for 2026-10-12
      And I start creating an event
      And I type "Zahn" in the event field "location"
      And I pick the place suggestion "Zahnarztpraxis Dr. Weber"
      Then I see no place suggestions
      And the event form shows:
        | location | Zahnarztpraxis Dr. Weber, Hauptstraße 12, 10827 Berlin |
      And the event dialog shows a map with a pin on "Zahnarztpraxis Dr. Weber"
      And the map credits OpenStreetMap

    @backlog
    Scenario: The picked place is saved with the event and its map shows again
      When I open the week view for 2026-10-12
      And I start creating an event
      And I fill in the event form with:
        | title      | Dentist    |
        | start date | 2026-10-14 |
        | start time | 09:00      |
        | end time   | 10:00      |
      And I type "Weber" in the event field "location"
      And I pick the place suggestion "Zahnarztpraxis Dr. Weber"
      And I save the event
      Then the Google event "Dentist" has:
        | location | Zahnarztpraxis Dr. Weber, Hauptstraße 12, 10827 Berlin |
      When I open the app again
      And I open the event "Dentist"
      Then the event dialog shows a map with a pin on "Zahnarztpraxis Dr. Weber"

    @backlog
    Scenario: A location typed without picking is kept as typed and shows no map
      When I open the week view for 2026-10-12
      And I start creating an event
      And I fill in the event form with:
        | title      | Dentist    |
        | start date | 2026-10-14 |
        | start time | 09:00      |
        | end time   | 10:00      |
      And I type "Zahnarzt am Markt" in the event field "location"
      And I save the event
      Then the Google event "Dentist" has:
        | location | Zahnarzt am Markt |
      When I open the event "Dentist"
      Then the event dialog shows no map

    @backlog
    Scenario: Changing the text of a picked place drops its map
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00 at the place "Zahnarztpraxis Dr. Weber"
      When I open the week view for 2026-10-12
      And I open the event "Dentist"
      And I fill in the event form with:
        | location | Zahnarzt am Markt |
      Then the event dialog shows no map
      When I save the event
      And I open the event "Dentist"
      Then the event dialog shows no map

  Rule: Without a connection the location is plain text and the map shows what the device already has

    @backlog @offline
    Scenario: Without a connection a location can still be typed, and nothing is suggested
      When I open the week view for 2026-10-12
      And I start creating an event
      And the network connection is lost
      And I type "Zahn" in the event field "location"
      Then I see no place suggestions
      And the event form shows:
        | location | Zahn |
      And the event dialog shows no error

    @backlog @offline
    Scenario: Without a connection the map of a place seen before still shows
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00 at the place "Zahnarztpraxis Dr. Weber"
      And I have seen the week view for 2026-10-12
      And I have seen the map of the event "Dentist"
      And the network connection is lost
      When I open the app again
      And I open the event "Dentist"
      Then the event dialog shows a map with a pin on "Zahnarztpraxis Dr. Weber"
      And the map credits OpenStreetMap

    @backlog @offline
    Scenario: Without a connection a map not seen before is a placeholder with the place
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00 at the place "Zahnarztpraxis Dr. Weber"
      And I have seen the week view for 2026-10-12
      And the network connection is lost
      When I open the app again
      And I open the event "Dentist"
      Then the event dialog shows a map placeholder for "Zahnarztpraxis Dr. Weber"

  Rule: The suggestions work with the keyboard and never get in the way of typing

    @backlog
    Scenario: Enter without a chosen suggestion keeps the text and moves on to the description
      When I open the week view for 2026-10-12
      And I start creating an event
      And I type "Zahn" in the event field "location"
      And I press Enter in the event field "location"
      Then I see no place suggestions
      And the event field "description" has focus
      And the event form shows:
        | location | Zahn |

    @backlog @desktop
    Scenario: Arrow down and Enter pick a suggestion
      When I open the week view for 2026-10-12
      And I start creating an event
      And I type "Zahn" in the event field "location"
      And I press Arrow down in the event field "location"
      And I press Enter in the event field "location"
      Then the event form shows:
        | location | Zahnarztpraxis Dr. Weber, Hauptstraße 12, 10827 Berlin |
      And the event dialog shows a map with a pin on "Zahnarztpraxis Dr. Weber"

    @backlog
    Scenario: Escape closes the suggestions and keeps the text and the dialog
      When I open the week view for 2026-10-12
      And I start creating an event
      And I type "Zahn" in the event field "location"
      And I press Escape
      Then I see no place suggestions
      And the event dialog is open
      And the event form shows:
        | location | Zahn |

  Rule: The map opens the place in a maps app

    @backlog
    Scenario: Tapping the map opens the place on OpenStreetMap in the browser
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00 at the place "Zahnarztpraxis Dr. Weber"
      When I open the week view for 2026-10-12
      And I open the event "Dentist"
      And I tap the map
      Then the OpenStreetMap page of the place "Zahnarztpraxis Dr. Weber" opens in a new tab

    @backlog @android-app
    Scenario: In the Android app tapping the map hands the place to the phone's maps app
      Given the app runs inside the Android app
      And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00 at the place "Zahnarztpraxis Dr. Weber"
      When I open the week view for 2026-10-12
      And I open the event "Dentist"
      And I tap the map
      Then the phone is asked to show the place "Zahnarztpraxis Dr. Weber" in a maps app

  Rule: Events that cannot be edited show their place's map too

    @backlog
    Scenario: A read-only event with a picked place shows the map
      Given a calendar "Anna" shared with me read-only by "anna@example.test"
      And the calendar "Anna" contains an event "Swimming" on 2026-10-15 from 18:00 to 19:00 at the place "Stadtbad Neukölln"
      When I open the week view for 2026-10-12
      And I open the event "Swimming"
      Then the event dialog is read-only
      And the event dialog shows a map with a pin on "Stadtbad Neukölln"

  Rule: A location typed elsewhere can be found on the map on request

    @backlog
    Scenario: A location from Google without a place offers to find it on the map
      Given the calendar contains an event "Swim" on 2026-10-15 from 18:00 to 19:00 at "Stadtbad Neukölln"
      When I open the week view for 2026-10-12
      And I open the event "Swim"
      Then the event dialog shows no map
      When I ask to find the location on the map
      And I pick the place suggestion "Stadtbad Neukölln"
      Then the event dialog shows a map with a pin on "Stadtbad Neukölln"
