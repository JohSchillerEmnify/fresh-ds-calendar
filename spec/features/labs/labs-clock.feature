@labs @clock @id:labs-clock
Feature: Labs: experimental views and the 24-hour clock
  Experimental views are tried out behind a Labs switch in the settings: when it is on, the view switcher offers them,
  marked as experimental; when it is off, nothing changes. The clock view shows one day as a 24-hour circle: events are
  arcs from their start to their end, task lists with a time are arcs as long as their estimate (30 minutes without
  one) and named with their done count, and a hand points at the current time. Task lists without a time and all-day
  events are chips next to the dial (below and above it on a phone, beside it on a wide screen), so the middle stays
  free for the time. The clock is as large as the space allows.
  Overlapping entries are drawn on separate rings, so no arc ever covers another; entries back to back on one ring keep
  a gap between them. On the dial an arc is at least 15 minutes long (longer with a minimum event length), so a short
  entry stays visible and tappable; its real times never change. Each name sits beside its own arc, never over another
  name, an arc or the middle; a name that finds no room on the dial is listed next to it with its time, and so is an
  entry beyond the sixth ring, which gets no arc (owner, 2026-10-23: "separate events overlap each other, the names
  are not drawn very well"). Names stay where they are while an arc is dragged; only the dragged one's name hides.
  The clock is a full calendar view (owner, 2026-10-13): a tap on an arc opens the entry, a long press picks it up and
  turns it round the dial (15-minute steps, its length kept), a long press released in place shows handles at both ends
  that change the start or the end, and a tap on the empty dial creates an entry at that time. Today the middle says
  what is running or comes next, and a shaded wedge from the hand shows the time until then (time made visible).

  Background:
    Given the calendar is empty
    And today is 2026-10-14
    And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00

  Scenario: Turning Labs on offers the experimental views
    When I open the week view for 2026-10-12
    And I turn on experimental views in the settings
    Then the view switcher offers the experimental views "Clock, Timeline"

  Scenario: Strip is off by default
    When I open the week view for 2026-10-12
    And I turn on experimental views in the settings
    Then the view switcher does not offer "Strip"

  Scenario: Choosing which Labs views appear
    When I open the week view for 2026-10-12
    And I turn on experimental views in the settings
    And I switch the Labs view "Strip" on in the settings
    Then the view switcher offers the experimental views "Clock, Timeline, Strip"
    When I switch the Labs view "Clock" off in the settings
    Then the view switcher offers the experimental views "Timeline, Strip"
    And the view switcher does not offer "Clock"

  Scenario: The clock shows the day as a 24-hour circle
    Given the time is 2026-10-14 09:30
    When I open the clock view for 2026-10-14
    Then the event "Dentist" is an arc from 09:00 to 10:00
    And the clock hand points at 09:30

  Scenario: The clock names each event
    When I open the clock view for 2026-10-14
    Then the arc of "Dentist" is labelled "Dentist"

  Scenario: Task lists with a time are named arcs as long as they take
    Given the calendar contains a task list "Laundry" on 2026-10-14 at 18:00 for 90 minutes with items:
      | item | done |
      | Wash | yes  |
      | Fold | no   |
    When I open the clock view for 2026-10-14
    Then the task list "Laundry" is an arc from 18:00 to 19:30
    And the arc of "Laundry" is labelled "Laundry 1/2"

  Scenario: A short task list right before an event is visible on the clock
    Given the calendar contains a task list "Einkaufsliste" on 2026-10-14 at 17:00 for 15 minutes with items:
      | item | done |
      | Milk | no   |
    And the calendar contains an event "Abend zu zweit" on 2026-10-14 from 17:15 to 21:30
    When I open the clock view for 2026-10-14
    Then the task list "Einkaufsliste" is an arc from 17:00 to 17:15
    And the arc of "Einkaufsliste" is not covered by the arc of "Abend zu zweit"
    And the arc of "Einkaufsliste" is labelled "Einkaufsliste 0/1"

  Scenario: Overlapping events are drawn on separate rings and never cover each other
    Given the calendar contains an event "Review" on 2026-10-14 from 09:30 to 11:00
    And the calendar contains an event "Call" on 2026-10-14 from 09:45 to 10:15
    When I open the clock view for 2026-10-14
    Then the arcs of "Dentist, Review, Call" are on different rings
    And no two arcs on the clock cover each other

  Scenario: Back-to-back events share a ring with a gap between them
    Given the calendar contains an event "Lunch" on 2026-10-14 from 10:00 to 11:00
    When I open the clock view for 2026-10-14
    Then the arcs of "Dentist" and "Lunch" are on the same ring with a gap between them

  Scenario: Very short back-to-back events get separate rings and keep their real times
    Given the calendar contains an event "Pill" on 2026-10-14 from 11:00 to 11:05
    And the calendar contains an event "Vitamins" on 2026-10-14 from 11:05 to 11:15
    When I open the clock view for 2026-10-14
    Then the arcs of "Pill, Vitamins" are on different rings
    And the event "Pill" is an arc from 11:00 to 11:05

  Scenario: The minimum event length counts on the clock too
    Given the minimum event length is 30 minutes
    And the calendar contains an event "Daily A" on 2026-10-14 from 11:00 to 11:15
    And the calendar contains an event "Daily B" on 2026-10-14 from 11:15 to 11:30
    When I open the clock view for 2026-10-14
    Then the arcs of "Daily A, Daily B" are on different rings

  Scenario: On a crowded day every name can be read and no two names overlap
    Given the calendar contains these events on 2026-10-14:
      | title                                         | from  | to    |
      | Early run                                     | 06:00 | 06:45 |
      | Design review with the whole product team     | 09:30 | 11:00 |
      | Call                                          | 09:45 | 10:15 |
      | Lunch                                         | 12:00 | 13:00 |
      | Physio                                        | 13:00 | 13:45 |
      | Pick up parcel                                | 14:00 | 14:10 |
      | Quick sync                                    | 14:10 | 14:20 |
      | Gym                                           | 17:00 | 18:30 |
      | Dinner with Anna and Tom at the Italian place | 19:30 | 22:00 |
      | Night train                                   | 23:00 | 23:59 |
    When I open the clock view for 2026-10-14
    Then every arc on the clock is named on the dial or next to it
    And no two names on the clock overlap

  Scenario: An entry listed next to the dial opens with a tap
    Given the calendar contains these events on 2026-10-14:
      | title    | from  | to    |
      | Standup  | 09:00 | 10:00 |
      | Review   | 09:00 | 10:00 |
      | Call     | 09:00 | 10:00 |
      | Sync     | 09:00 | 10:00 |
      | Retro    | 09:00 | 10:00 |
      | Planning | 09:00 | 10:00 |
      | Coffee   | 09:15 | 10:00 |
    When I open the clock view for 2026-10-14
    Then the clock lists "09:15 Coffee" next to the dial
    When I tap "Coffee" in the list next to the clock
    Then the event dialog is open

  Scenario: Task lists without a time are listed next to the dial
    Given the calendar contains a task list "Groceries" on 2026-10-14 with items:
      | item | done |
      | Milk | no   |
    When I open the clock view for 2026-10-14
    Then the clock lists "Groceries 0/1" without a time

  Scenario: The clock uses the space it is given
    When I open the clock view for 2026-10-14
    Then the clock fills the available space

  Scenario: Moving in time stays on the clock, switching to Day leaves it
    When I open the clock view for 2026-10-14
    And I go to the next period
    Then the URL path is "/clock/2026-10-15"
    When I switch to the day view
    Then the URL path is "/day/2026-10-15"

  Scenario: A tap on an event arc opens the event
    When I open the clock view for 2026-10-14
    And I tap the arc of "Dentist"
    Then the event dialog is open

  Scenario: A tap on a timed task list opens it
    Given the calendar contains a task list "Laundry" on 2026-10-14 at 18:00 for 90 minutes with items:
      | item | done |
      | Wash | no   |
    When I open the clock view for 2026-10-14
    And I tap the arc of "Laundry"
    Then the task list "Laundry" is expanded

  Scenario: A long press turns an event round the dial
    When I open the clock view for 2026-10-14
    And I turn the arc of "Dentist" to 11:00
    Then the event "Dentist" is an arc from 11:00 to 12:00
    When I reload the page
    Then the event "Dentist" is an arc from 11:00 to 12:00

  Scenario: A timed task list turns round the dial too
    Given the calendar contains a task list "Laundry" on 2026-10-14 at 18:00 for 90 minutes with items:
      | item | done |
      | Wash | no   |
    When I open the clock view for 2026-10-14
    And I turn the arc of "Laundry" to 20:00
    Then the task list "Laundry" is an arc from 20:00 to 21:30

  Scenario: The handles of a selected arc change its start and end
    When I open the clock view for 2026-10-14
    And I select the arc of "Dentist"
    And I drag the end handle of "Dentist" to 10:30
    Then the event "Dentist" is an arc from 09:00 to 10:30
    When I drag the start handle of "Dentist" to 08:30
    Then the event "Dentist" is an arc from 08:30 to 10:30

  Scenario: A tap on the empty dial creates an entry at that time
    When I open the clock view for 2026-10-14
    And I tap the clock at 15:00
    Then the event dialog is open
    And the event form shows:
      | start date | 2026-10-14 |
      | start time | 15:00      |

  Scenario Outline: Today the middle says what is running or comes next and shades the time until then
    Given the time is 2026-10-14 <time>
    When I open the clock view for 2026-10-14
    Then the middle of the clock says "<middle>"
    And the clock shades the time until <until>

    Examples:
      | time  | middle                | until |
      | 08:00 | Next: Dentist in 1 h  | 09:00 |
      | 09:30 | Dentist · 30 min left | 10:00 |

  Scenario: All-day events are listed next to the dial
    Given the calendar contains an all-day event "Holiday" on 2026-10-14
    When I open the clock view for 2026-10-14
    Then the clock shows the all-day event "Holiday"

  @backlog
  Scenario: A Labs view that is not offered still opens by its address
    When I open the clock view for 2026-10-14
    Then the event "Dentist" is an arc from 09:00 to 10:00
    And the view switcher does not offer "Clock"
