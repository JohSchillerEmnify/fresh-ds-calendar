@door @id:door-board
Feature: Reminders and today's events for the door board
  The door board is a small e-ink screen on the inside of the front door that shows what to remember
  before leaving. Its renderer asks the calendar for two things: the open items of the task lists that
  are marked for the door, and today's events, so it can show the next one that has not started yet.
  Nothing else leaves the calendar that way — no descriptions, no attendees, no places. The board's key
  belongs to one person: the door shows that person's lists and events only. A dated list is due from
  its day, whatever its time; an undated one is due until it is done. The whole door is a deployment
  choice, off unless the operator set a key: a public instance without one has no switch and no door.

  Background:
    Given the calendar is empty
    And today is 2026-10-19
    And the door board has the key of the owner

  Rule: A door list shows its open items from its date until every item is ticked

    Scenario: Before its date a door list stays off the door
      Given the calendar contains a task list "Friday errands" on 2026-10-23 with items:
        | Post office |
        | Pharmacy    |
      And "Friday errands" is set to show on the door
      When the door board asks for its reminders
      Then it gets no reminders

    Scenario: From its date the open items are on the door
      Given the calendar contains a task list "Friday errands" on 2026-10-19 with items:
        | item        | done |
        | Post office | yes  |
        | Pharmacy    | no   |
      And "Friday errands" is set to show on the door
      When the door board asks for its reminders
      Then it gets the reminders:
        | item     | list           | date       |
        | Pharmacy | Friday errands | 2026-10-19 |

    Scenario: A list that is not marked stays off the door
      Given the calendar contains a task list "Groceries" on 2026-10-19 with items:
        | Tomatoes |
      When the door board asks for its reminders
      Then it gets no reminders

    Scenario: An undated door list is due until it is done
      Given the calendar contains an undated task list "Before any trip" with items:
        | Passport |
      And "Before any trip" is set to show on the door
      When the door board asks for its reminders
      Then it gets the reminders:
        | item     | list            | date |
        | Passport | Before any trip |      |

    Scenario: Older lists come first, items in their list's order
      Given the calendar contains a task list "Parcel" on 2026-10-17 at 09:00 with items:
        | Return the shoes |
      And the calendar contains a task list "Friday errands" on 2026-10-19 with items:
        | Post office |
        | Pharmacy    |
      And "Parcel" is set to show on the door
      And "Friday errands" is set to show on the door
      When the door board asks for its reminders
      Then it gets the reminders:
        | item             | list           | date       | time  |
        | Return the shoes | Parcel         | 2026-10-17 | 09:00 |
        | Post office      | Friday errands | 2026-10-19 |       |
        | Pharmacy         | Friday errands | 2026-10-19 |       |

  Rule: A repeating door list shows only its latest due occurrence

    Scenario: Last week's forgotten occurrence drops off once this week's is due
      Given the calendar contains a weekly task list "Bin day" on Mondays since 2026-10-12 with items:
        | Bins out |
      And "Bin day" is set to show on the door
      And "Bins out" of "Bin day" on 2026-10-12 is still open
      When the door board asks for its reminders
      Then it gets the reminders:
        | item     | list    | date       |
        | Bins out | Bin day | 2026-10-19 |

  Rule: The door board sees today's events, titles and times only

    Scenario: Today's timed and all-day events, in local time
      Given the calendar contains an event "Standup" on 2026-10-19 from 09:00 to 09:30
      And the calendar contains an all-day event "Trip" on 2026-10-19
      And the calendar contains an event "Dentist" on 2026-10-20 from 08:00 to 08:30 with the description "Bring the card"
      When the door board asks for today's events
      Then it gets the events:
        | title   | start            | end              | all day |
        | Trip    | 2026-10-19       | 2026-10-20       | yes     |
        | Standup | 2026-10-19T09:00 | 2026-10-19T09:30 | no      |
      And nothing but titles and times is in the answer

  Rule: Only the door board may read

    Scenario: Without its key the door board is turned away
      Given the calendar contains a task list "Friday errands" on 2026-10-19 with items:
        | Pharmacy |
      And "Friday errands" is set to show on the door
      When something asks for the door's reminders with a wrong key
      Then it is refused as unauthenticated and gets nothing

    Scenario: Another person's door list is not this door's business
      Given another person "Mira" has a task list "Mira's errands" on 2026-10-19 marked to show on the door with items:
        | Bakery |
      When the door board asks for its reminders
      Then it gets no reminders

  Rule: The door exists only where the deployment set it up

    Scenario: Without a key there is no door at all
      Given the door board's key is taken away
      And the calendar contains a task list "Groceries" on 2026-10-19 with items:
        | Tomatoes |
      When I edit the task list "Groceries"
      Then there is no "Show on door" switch
      And asking for the door's reminders finds no such thing

  Rule: "Show on door" is switched in the list form and in the list sheet

    Scenario: Marking a list for the door in its form
      Given the calendar contains a task list "Friday errands" on 2026-10-19 with items:
        | Pharmacy |
      When I edit the task list "Friday errands" and turn "Show on door" on
      Then "Friday errands" is marked to show on the door
      And the door board gets "Pharmacy" from "Friday errands"

    Scenario: Marking a list for the door from its sheet
      Given the calendar contains a task list "Friday errands" on 2026-10-19 with items:
        | Pharmacy |
      When I open the list sheet of "Friday errands" and turn "Show on door" on
      Then "Friday errands" is marked to show on the door

  Rule: The door key must be long enough to resist guessing

    # unit: server/test/hardening-door.test.ts:keeps the door off (and says so) for a key shorter than 32 characters
    @unit
    Scenario: A key shorter than 32 characters keeps the door off
      Given the operator's door key is only 20 characters long
      When the server starts
      Then the door stays off
      And the operator is told the key must have at least 32 characters

    # unit: server/test/hardening-door.test.ts:keeps the door off (and says so) for a key shorter than 32 characters
    @unit
    Scenario: A key of 32 characters or more switches the door on
      Given the operator's door key is 40 characters long
      When the server starts
      Then the door is on

  Rule: The door answers at most 60 times a minute per client

    Scenario: The 61st ask within a minute is told to slow down
      When the door board asks for its reminders 61 times within a minute
      Then the first 60 are answered
      And the next one is told there are too many requests

    # unit: server/test/hardening-door.test.ts:a flood of distinct clients does not reset the counter of one that is over its limit
    @unit
    Scenario: A flood of other clients does not free a client that is over its limit
      Given the server sits behind the trusted proxy
      And one client has used up its 60 asks of this minute
      When 1100 other clients ask once each
      Then the client that used up its asks is still told there are too many requests

  Rule: Clients are told apart by the trusted proxy's address only

    # unit: server/test/hardening-door.test.ts:ignores X-Forwarded-For unless the server sits behind a trusted proxy
    @unit
    Scenario: Without a trusted proxy a made-up forwarding header does not buy more asks
      Given the server does not sit behind a trusted proxy
      When one client asks 70 times, each time claiming to come from a different address
      Then 10 of the asks are told there are too many requests

    # unit: server/test/hardening-door.test.ts:behind a trusted proxy the last hop is the client, so rotating the first entry does not help
    @unit
    Scenario: Behind a trusted proxy the client is the address the proxy saw
      Given the server sits behind the trusted proxy
      When one client asks 70 times, each time claiming a different first address but arriving through the same last hop
      Then 10 of the asks are told there are too many requests
      And a client arriving through another last hop still has its own 60 asks

  Rule: A person who may no longer use the calendar gets no board

    Scenario: The door's person is taken off the list of allowed people
      Given "jo@example.com" and "anna@example.com" may use the calendar
      And the door board has the key of "jo@example.com"
      And the door board asks for its reminders
      And it gets no reminders
      When "jo@example.com" may no longer use the calendar
      And the door board asks for its reminders
      Then it is told the door's person is not available
