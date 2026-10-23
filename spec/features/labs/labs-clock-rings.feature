@labs @clock @id:labs-clock-rings
Feature: Labs: the clock with names along its rings
  A variant of the 24-hour clock (labs-clock) to compare with it on the phone (owner, 2026-10-23: "you may create
  copies or versions of it as experimental views"). It is the same dial with the same gestures and middle text, but the
  rings are wide lanes, each drawn on a faint track, and every name is written along its ring inside the lane: it
  starts at its arc and runs on along the free ring, turned on the lower half of the dial so it is never upside down.
  An entry that would cut the name before it short goes one ring further in; a name that still has no room for three
  characters is listed next to the dial with its time, like the clock. It is off until switched on in the Labs
  settings.

  Background:
    Given the calendar is empty
    And today is 2026-10-14
    And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00

  Scenario: The rings clock is offered only once it is switched on
    When I open the week view for 2026-10-12
    And I turn on experimental views in the settings
    Then the view switcher does not offer "Clock: rings"
    When I switch the Labs view "Clock: rings" on in the settings
    Then the view switcher offers the experimental views "Clock, Clock: rings"

  Scenario: Names run along their arcs and are never upside down
    Given the calendar contains an event "Lunch with Sam" on 2026-10-14 from 12:00 to 14:00
    And the calendar contains an event "Evening walk" on 2026-10-14 from 19:00 to 21:00
    When I open the rings clock for 2026-10-14
    Then the arc of "Lunch with Sam" is labelled "Lunch with Sam"
    And no name on the clock is upside down

  Scenario: Overlapping events are on separate rings on the rings clock too
    Given the calendar contains an event "Review" on 2026-10-14 from 09:30 to 11:00
    And the calendar contains an event "Call" on 2026-10-14 from 09:45 to 10:15
    When I open the rings clock for 2026-10-14
    Then the arcs of "Dentist, Review, Call" are on different rings
    And no two arcs on the clock cover each other

  Scenario: On a crowded day every name on the rings clock can be read and no two names overlap
    Given the calendar contains these events on 2026-10-14:
      | title                                         | from  | to    |
      | Design review with the whole product team     | 09:30 | 11:00 |
      | Call                                          | 09:45 | 10:15 |
      | Lunch                                         | 12:00 | 13:00 |
      | Physio                                        | 13:00 | 13:45 |
      | Pick up parcel                                | 14:00 | 14:10 |
      | Quick sync                                    | 14:10 | 14:20 |
      | Dinner with Anna and Tom at the Italian place | 19:30 | 22:00 |
    When I open the rings clock for 2026-10-14
    Then every arc on the clock is named on the dial or next to it
    And no two names on the clock overlap

  Scenario: A tap on an arc of the rings clock opens the event
    When I open the rings clock for 2026-10-14
    And I tap the arc of "Dentist"
    Then the event dialog is open
