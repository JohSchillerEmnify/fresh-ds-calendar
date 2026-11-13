@events @location @id:event-location
Feature: Places for an event's location
  While the location of an event is typed, matching places from OpenStreetMap are suggested (owner, board item g6:
  "Location: address suggestions + small map", Photon for the suggestions, an OpenStreetMap map, no API key). Picking
  one puts the place's name in the field with its address as a small second line under it (owner, 2026-10-26: no
  cut-off address) and shows a small map with a pin under that; the map carries the OpenStreetMap credit. Typing stays plain text: a location that is not picked is kept exactly as typed and
  shows no map.
  The app asks the place search (Photon) and the OpenStreetMap map pictures straight from the device, not through the
  app's server (owner, 2026-10-26). Only the typed text (at least 3 characters, after a short pause) and the app's
  language are sent with a search (owner, 2026-10-26), no nearby preference; like any web page, the device's address and
  the app's site are seen by them. There is no switch to turn suggestions off for now.
  Google Calendar gets the location as "<name>, <address>", readable there as usual, and the place's name and
  position are stored with the event in Google's private event properties (owner), so the name, the address line and
  the map show again on every device without a new search.
  Like everything else, the location and the place's position are kept on the device (ADR 0025): without a connection
  the field is plain text and nothing is suggested; the map shows from the pictures the device has already seen, and
  otherwise a placeholder with the pin and the place's name.
  Tapping an event opens its sheet (there is no separate details page), so the map lives in that sheet under the
  location field, and in the read-only sheet of events that cannot be edited (owner, 2026-10-26). When an event with a
  location is opened, the location and its map sit right under the title, so the map shows without scrolling; a new
  event keeps the location field in its usual place. Tapping the map opens the place in the phone's maps app in the
  Android app and on the OpenStreetMap website in a browser (owner). Under the map two buttons, "Google Maps" and
  "OpenStreetMap", open the place in that map (owner, 2026-11-09); no place is searched for a location typed as text.

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And the place search knows:
      | name                     | address                          | latitude | longitude |
      | Zahnarztpraxis Dr. Weber | Hauptstraße 12, 10827 Berlin     | 52.4867  | 13.3536   |
      | Zahnklinik Mitte         | Friedrichstraße 90, 10117 Berlin | 52.5200  | 13.3880   |
      | Stadtbad Neukölln        | Ganghoferstraße 3, 12043 Berlin  | 52.4797  | 13.4361   |

  Rule: Typing a location suggests places; a picked place fills the field and shows a small map

    Scenario: Typing a location suggests matching places
      When I open the week view for 2026-10-12
      And I start creating an event
      And I type "Zahn" in the event field "location"
      Then I see the place suggestions:
        | name                     | address                          |
        | Zahnarztpraxis Dr. Weber | Hauptstraße 12, 10827 Berlin     |
        | Zahnklinik Mitte         | Friedrichstraße 90, 10117 Berlin |
      And the suggestions credit OpenStreetMap

    Scenario: Fewer than three characters suggest nothing
      When I open the week view for 2026-10-12
      And I start creating an event
      And I type "Za" in the event field "location"
      Then I see no place suggestions

    Scenario: Picking a place puts its name in the field, its address under it, and shows a small map
      When I open the week view for 2026-10-12
      And I start creating an event
      And I type "Zahn" in the event field "location"
      And I pick the place suggestion "Zahnarztpraxis Dr. Weber"
      Then I see no place suggestions
      And the event form shows:
        | location | Zahnarztpraxis Dr. Weber |
      And the location's address line says "Hauptstraße 12, 10827 Berlin"
      And the event dialog shows a map with a pin on "Zahnarztpraxis Dr. Weber"
      And the map credits OpenStreetMap

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
      Then the event form shows:
        | location | Zahnarztpraxis Dr. Weber |
      And the location's address line says "Hauptstraße 12, 10827 Berlin"
      And the event dialog shows a map with a pin on "Zahnarztpraxis Dr. Weber"

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
      And the location has no address line

    Scenario: Changing the text of a picked place drops its map
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00 at the place "Zahnarztpraxis Dr. Weber"
      When I open the week view for 2026-10-12
      And I open the event "Dentist"
      And I fill in the event form with:
        | location | Zahnarzt am Markt |
      Then the event dialog shows no map
      And the location has no address line
      When I save the event
      And I open the event "Dentist"
      Then the event dialog shows no map

    Scenario: A location changed in Google Calendar is kept as it is and shows no map
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00 at the place "Zahnarztpraxis Dr. Weber"
      And Google changes the location of the event "Dentist" to "Zahnarztpraxis Dr. Weber (Haus 2)"
      When I open the week view for 2026-10-12
      And I open the event "Dentist"
      Then the event form shows:
        | location | Zahnarztpraxis Dr. Weber (Haus 2) |
      And the event dialog shows no map
      When I fill in the event form with:
        | title | Dentist at Weber |
      And I save the event
      Then the Google event "Dentist at Weber" has:
        | location | Zahnarztpraxis Dr. Weber (Haus 2) |

    Scenario: An opened event shows its location and map right under the title
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00 at the place "Zahnarztpraxis Dr. Weber"
      When I open the week view for 2026-10-12
      And I open the event "Dentist"
      Then the event form starts with the fields "title, location"
      And the map is shown without scrolling the event dialog

  Rule: Without a connection the location is plain text and the map shows what the device already has

    @offline
    Scenario: Without a connection a location can still be typed, and nothing is suggested
      When I open the week view for 2026-10-12
      And I start creating an event
      And the network connection is lost
      And I type "Zahn" in the event field "location"
      Then I see no place suggestions
      And the event form shows:
        | location | Zahn |
      And the event dialog shows no error

    @offline
    Scenario: Without a connection the map of a place seen before still shows
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00 at the place "Zahnarztpraxis Dr. Weber"
      And I have seen the week view for 2026-10-12
      And I have seen the map of the event "Dentist"
      And the network connection is lost
      When I open the app again
      And I open the event "Dentist"
      Then the event dialog shows a map with a pin on "Zahnarztpraxis Dr. Weber"
      And the map credits OpenStreetMap

    @offline
    Scenario: Without a connection a map not seen before is a placeholder with the place
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00 at the place "Zahnarztpraxis Dr. Weber"
      And I have seen the week view for 2026-10-12
      And the network connection is lost
      When I open the app again
      And I open the event "Dentist"
      Then the event dialog shows a map placeholder for "Zahnarztpraxis Dr. Weber"

  Rule: The suggestions work with the keyboard and never get in the way of typing

    Scenario: Enter without a chosen suggestion keeps the text and moves on to the description
      When I open the week view for 2026-10-12
      And I start creating an event
      And I type "Zahn" in the event field "location"
      And I press Enter in the event field "location"
      Then I see no place suggestions
      And the event field "description" has focus
      And the event form shows:
        | location | Zahn |

    @desktop
    Scenario: Arrow down and Enter pick a suggestion
      When I open the week view for 2026-10-12
      And I start creating an event
      And I type "Zahn" in the event field "location"
      And I press Arrow down in the event field "location"
      And I press Enter in the event field "location"
      Then the event form shows:
        | location | Zahnarztpraxis Dr. Weber |
      And the location's address line says "Hauptstraße 12, 10827 Berlin"
      And the event dialog shows a map with a pin on "Zahnarztpraxis Dr. Weber"

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

  Rule: Under the map two buttons open the place in Google Maps or on OpenStreetMap

    Scenario: A place's map has the buttons Google Maps and OpenStreetMap under it
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00 at the place "Zahnarztpraxis Dr. Weber"
      When I open the week view for 2026-10-12
      And I open the event "Dentist"
      Then I see the map buttons "Google Maps, OpenStreetMap" under the map

    Scenario: The Google Maps button opens Google Maps at the place's position
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00 at the place "Zahnarztpraxis Dr. Weber"
      When I open the week view for 2026-10-12
      And I open the event "Dentist"
      And I tap the map button "Google Maps"
      Then the Google Maps page of the place "Zahnarztpraxis Dr. Weber" opens in a new tab

    Scenario: The OpenStreetMap button opens OpenStreetMap at the place
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00 at the place "Zahnarztpraxis Dr. Weber"
      When I open the week view for 2026-10-12
      And I open the event "Dentist"
      And I tap the map button "OpenStreetMap"
      Then the OpenStreetMap page of the place "Zahnarztpraxis Dr. Weber" opens in a new tab

  Rule: Events that cannot be edited show their place's map too

    Scenario: A read-only event with a picked place shows the map
      Given a calendar "Anna" shared with me read-only by "anna@example.test"
      And the calendar "Anna" contains an event "Swimming" on 2026-10-15 from 18:00 to 19:00 at the place "Stadtbad Neukölln"
      When I open the week view for 2026-10-12
      And I open the event "Swimming"
      Then the event dialog is read-only
      And the event dialog shows a map with a pin on "Stadtbad Neukölln"
      And I see the map buttons "Google Maps, OpenStreetMap" under the map

  Rule: Pick on map: when the search finds nothing, a place is picked by moving a map under a fixed pin
    Under the location field a tonal "Pick on map" action opens a full-screen page (owner, mockup 2026-11-10): the map
    moves under a pin that stays in the middle, a search pill finds a street or place, "Use my location" moves the map
    to the device (asked for only on its first tap), and the bottom panel shows the readable address and the position
    of the pin, with "Cancel" and "Use this place". The map is Leaflet on the same OpenStreetMap pictures as the small
    map; the address comes from the same place search (Photon), asked only after the map has come to rest. Using the
    place puts the readable address in the location field and shows the small map and the two map buttons as for a
    suggested place. Online only: without a connection the page says so and offers to type an address instead.

    Scenario: Pick on map is offered next to the location field
      When I open the week view for 2026-10-12
      And I start creating an event
      Then I see the action "Pick on map" at the event location

    Scenario: The picker search is the same search bar as in the settings
      When I open the week view for 2026-10-12
      And I start creating an event
      And I open the map picker
      Then the map picker search bar is full round and 56 px high

    Scenario: Searching in the picker moves the map and shows the address of the pin
      When I open the week view for 2026-10-12
      And I start creating an event
      And I open the map picker
      And I search the map picker for "Stadtbad"
      And I pick the map picker result "Stadtbad Neukölln"
      Then the map picker is centred on the place "Stadtbad Neukölln"
      And the map picker shows the address "Stadtbad Neukölln, Ganghoferstraße 3, 12043 Berlin"
      And the map picker credits OpenStreetMap

    Scenario: Dragging the map moves the position under the pin
      When I open the week view for 2026-10-12
      And I start creating an event
      And I open the map picker
      And I search the map picker for "Stadtbad"
      And I pick the map picker result "Stadtbad Neukölln"
      And I drag the map picker by 120 pixels
      Then the position of the pin has changed

    Scenario: Using the place fills the location field and shows the small map
      When I open the week view for 2026-10-12
      And I start creating an event
      And I open the map picker
      And I search the map picker for "Stadtbad"
      And I pick the map picker result "Stadtbad Neukölln"
      And I use the place in the map picker
      Then the map picker is closed
      And the event form shows:
        | location | Stadtbad Neukölln, Ganghoferstraße 3, 12043 Berlin |
      And the event dialog shows a map with a pin on "Stadtbad Neukölln"
      And I see the map buttons "Google Maps, OpenStreetMap" under the map

    Scenario: Cancel keeps the place the event had
      Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00 at the place "Zahnarztpraxis Dr. Weber"
      When I open the week view for 2026-10-12
      And I open the event "Dentist"
      And I open the map picker
      And I search the map picker for "Stadtbad"
      And I pick the map picker result "Stadtbad Neukölln"
      And I cancel the map picker
      Then the map picker is closed
      And the event form shows:
        | location | Zahnarztpraxis Dr. Weber |
      And the event dialog shows a map with a pin on "Zahnarztpraxis Dr. Weber"

    Scenario: Use my location moves the map to the device
      Given the device reports the position of the place "Stadtbad Neukölln"
      When I open the week view for 2026-10-12
      And I start creating an event
      And I open the map picker
      And I tap "Use my location" in the map picker
      Then the map picker is centred on the place "Stadtbad Neukölln"

    Scenario: A refused location is explained and the picker keeps working
      Given the device refuses to tell its position
      When I open the week view for 2026-10-12
      And I start creating an event
      And I open the map picker
      And I tap "Use my location" in the map picker
      Then the map picker says the location is not available
      And I search the map picker for "Stadtbad"
      And I pick the map picker result "Stadtbad Neukölln"
      And the map picker is centred on the place "Stadtbad Neukölln"

    @visual @mobile
    Scenario Outline: The map picker and the event sheet look as drawn, light and dark
      Given the device prefers a <scheme> color scheme
      When I open the week view for 2026-10-12
      And I start creating an event
      And I see the action "Pick on map" at the event location
      When I open the map picker
      And I search the map picker for "Stadtbad"
      And I pick the map picker result "Stadtbad Neukölln"
      Then the map picker shows the address "Stadtbad Neukölln, Ganghoferstraße 3, 12043 Berlin"
      And the "map picker" still looks like "map-picker-<scheme>"
      When I use the place in the map picker
      Then the "event dialog" still looks like "location-picked-<scheme>"

      Examples:
        | scheme |
        | light  |
        | dark   |

    @visual @mobile @offline
    Scenario Outline: The offline map picker looks as drawn, light and dark
      Given the device prefers a <scheme> color scheme
      When I open the week view for 2026-10-12
      And I start creating an event
      And the network connection is lost
      And I open the map picker
      Then the "map picker" still looks like "map-picker-offline-<scheme>"

      Examples:
        | scheme |
        | light  |
        | dark   |

    @unit
    # unit: web/test/calendar/map-picker.test.ts:asks for the device position only on the first tap
    Scenario: The device position is asked for only when "Use my location" is tapped
      When I open the week view for 2026-10-12
      And I start creating an event
      And I open the map picker
      Then the device was not asked for its position

    @offline
    Scenario: Without a connection the picker says it needs one and offers to type an address
      When I open the week view for 2026-10-12
      And I start creating an event
      And the network connection is lost
      And I open the map picker
      Then the map picker says it needs a connection
      When I choose "Type an address instead" in the map picker
      Then the map picker is closed
      And the event field "location" has focus

  Rule: Later slice — a location typed elsewhere can be looked up as a place, only on request
    The location text is sent to the place search only when the person asks (owner, 2026-10-26).

    @backlog
    Scenario: A location from Google without a place offers to look it up as a place
      Given the calendar contains an event "Swim" on 2026-10-15 from 18:00 to 19:00 at "Stadtbad Neukölln"
      When I open the week view for 2026-10-12
      And I open the event "Swim"
      Then the event dialog shows no map
      When I ask to find the location on the map
      And I pick the place suggestion "Stadtbad Neukölln"
      Then the event dialog shows a map with a pin on "Stadtbad Neukölln"
