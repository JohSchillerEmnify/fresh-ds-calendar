@offline @offline-changes @id:offline-changes
Feature: Changes I make without a connection are kept on this device and sent later
  The device store comes first for writing too (ADR 0025): a change is applied on this device at once, written to
  the outbox, and sent to the server in order as soon as there is a connection. The server writes to Google and
  answers with the stored version, which replaces the device copy. Nothing marks a change as unsent and nothing
  counts them (ADR 0031); the person simply sees what they did.
  Only when no send or sync has succeeded for 5 minutes does a "sync failed" icon appear in the top bar, beside the
  sync status; tapping it shows when the last sync succeeded and which changes are not synced yet. The next
  successful send or sync takes the icon away. The sync error banner is not shown for a send that fails.
  This feature covers events, task lists and their items; settings, preferences, themes, templates, the Canvas and
  sharing follow in slice 3. Reading offline is feature last-known-state.
  The outbox is sent when the app opens, regains focus or the connection, at the polling interval, and once a change
  reaches the server every other open app takes it in within about a second (feature last-known-state, rule "Live sync").
  A failed send because of the network, an unreachable Google or an expired session never loses the change: it stays
  in the outbox. A change the server refuses is undone on this device, and a persistent notice tells the person
  with "Edit again", which reopens the form with what they typed.
  If the same thing was changed elsewhere meanwhile, the last change wins (ADR 0031): the change that reaches the
  server last is applied on top of whatever is there, and only the fields it touches change; the other side is not
  told.
  The outbox belongs to the person who made the changes and is never sent under another person.

  Background:
    Given the calendar is empty
    And the time is 2026-10-12 08:12

  Rule: A change made offline shows at once and is sent when the connection is back

    Scenario: Ticking an item offline shows it ticked at once and sends it later
      Given the calendar contains a task list "Groceries" on 2026-10-12 with items:
        | item | done |
        | Milk | no   |
        | Eggs | no   |
      And automatic sync is disabled
      And I have seen the day view for 2026-10-12
      And the network connection is lost
      When I expand the task list "Groceries"
      And I tick the item "Milk"
      Then the item "Milk" is ticked
      And this device keeps 1 unsent change
      And I do not see the sync error banner
      And I do not see the sync failed icon
      And the server has the task list "Groceries" with items:
        | item | done |
        | Milk | no   |
        | Eggs | no   |
      When the network connection is restored
      And I wait until the changes are sent
      Then the item "Milk" is ticked
      And this device keeps no unsent changes
      And the server has the task list "Groceries" with items:
        | item | done |
        | Milk | yes  |
        | Eggs | no   |

    Scenario: Several changes made offline are sent in the order they were made
      Given the calendar contains a task list "Groceries" on 2026-10-12 with items:
        | item | done |
        | Milk | no   |
        | Eggs | no   |
      And automatic sync is disabled
      And I have seen the day view for 2026-10-12
      And the network connection is lost
      When I expand the task list "Groceries"
      And I add the item "Butter"
      And I tick the item "Butter"
      And I rename the item "Milk" to "Oat milk"
      And I delete the item "Eggs"
      And the undo time is over
      Then this device keeps 4 unsent changes
      And the expanded task list items are "Oat milk, Butter"
      When the network connection is restored
      And I wait until the changes are sent
      Then the server has the task list "Groceries" with items:
        | item     | done |
        | Oat milk | no   |
        | Butter   | yes  |
      And this device keeps no unsent changes

    Scenario: Creating an event offline shows it at once and keeps its place when it is sent
      Given automatic sync is disabled
      And I have seen the week view for 2026-10-12
      And the network connection is lost
      When I click the time slot 10:00 on 2026-10-13
      And I fill in the event form with:
        | title      | Dentist |
        | start time | 10:00   |
        | end time   | 11:00   |
      And I save the event
      Then the event "Dentist" is positioned on 2026-10-13 from 10:00 to 11:00
      And the server has no event "Dentist"
      When the network connection is restored
      And I wait until the changes are sent
      Then the event "Dentist" is positioned on 2026-10-13 from 10:00 to 11:00
      And the server has the event "Dentist" on 2026-10-13 from 10:00 to 11:00

    Scenario: Editing an event offline
      Given the calendar contains an event "Dentist" on 2026-10-13 from 10:00 to 11:00
      And automatic sync is disabled
      And I have seen the week view for 2026-10-12
      And the network connection is lost
      When I open the event "Dentist"
      And I fill in the event form with:
        | title      | Dentist Meyer |
        | start time | 14:00         |
        | end time   | 15:00         |
      And I save the event
      Then the event "Dentist Meyer" is positioned on 2026-10-13 from 14:00 to 15:00
      And the server has the event "Dentist" on 2026-10-13 from 10:00 to 11:00
      When the network connection is restored
      And I wait until the changes are sent
      Then the server has the event "Dentist Meyer" on 2026-10-13 from 14:00 to 15:00
      And the server has no event "Dentist"

    Scenario: Deleting an event offline hides it at once and removes it when the connection is back
      Given the calendar contains an event "Dentist" on 2026-10-13 from 10:00 to 11:00
      And automatic sync is disabled
      And I have seen the week view for 2026-10-12
      And the network connection is lost
      When I open the event "Dentist"
      And I delete the event
      And the undo time is over
      Then I do not see the event "Dentist"
      And this device keeps 1 unsent change
      And the server has the event "Dentist" on 2026-10-13 from 10:00 to 11:00
      When the network connection is restored
      And I wait until the changes are sent
      Then I do not see the event "Dentist"
      And the server has no event "Dentist"

    Scenario: A deletion undone within the undo time is never sent
      Given the calendar contains an event "Dentist" on 2026-10-13 from 10:00 to 11:00
      And automatic sync is disabled
      And I have seen the week view for 2026-10-12
      And the network connection is lost
      When I open the event "Dentist"
      And I delete the event
      And I undo the deletion
      Then I see the event "Dentist" on 2026-10-13
      And this device keeps no unsent changes

    Scenario: A task list created offline can be changed before it was ever sent and keeps its place
      Given automatic sync is disabled
      And I have seen the week view for 2026-10-12
      And the network connection is lost
      When I start creating a task list
      And I fill in the task list form with:
        | title | Packing              |
        | date  | 2026-10-14           |
        | items | Passport; Sunscreen  |
      And I save the task list
      Then I see the task list "Packing" on 2026-10-14
      When I expand the task list "Packing"
      And I tick the item "Passport"
      Then this device keeps 2 unsent changes
      And the server has no task list "Packing"
      When the network connection is restored
      And I wait until the changes are sent
      Then the task list "Packing" is expanded
      And the item "Passport" is ticked
      And the server has the task list "Packing" with items:
        | item      | done |
        | Passport  | yes  |
        | Sunscreen | no   |

    Scenario: Editing a task list offline
      Given the calendar contains a task list "Groceries" on 2026-10-12 with items:
        | item | done |
        | Milk | no   |
      And automatic sync is disabled
      And I have seen the day view for 2026-10-12
      And the network connection is lost
      When I expand the task list "Groceries"
      And I edit the task list details
      And I fill in the task list form with:
        | title | Weekend groceries |
      And I save the task list
      Then I see the task list "Weekend groceries" on 2026-10-12
      When the network connection is restored
      And I wait until the changes are sent
      Then the server has the task list "Weekend groceries" with items:
        | item | done |
        | Milk | no   |
      And the server has no task list "Groceries"

    Scenario: Deleting a task list offline
      Given the calendar contains a task list "Groceries" on 2026-10-12 with items:
        | item | done |
        | Milk | no   |
      And automatic sync is disabled
      And I have seen the day view for 2026-10-12
      And the network connection is lost
      When I expand the task list "Groceries"
      And I delete the task list
      And the undo time is over
      Then I do not see the task list "Groceries"
      And this device keeps 1 unsent change
      When the network connection is restored
      And I wait until the changes are sent
      Then the server has no task list "Groceries"

    Scenario: A change made offline is still there after the app opens again offline
      Given the calendar contains a task list "Groceries" on 2026-10-12 with items:
        | item | done |
        | Milk | no   |
      And automatic sync is disabled
      And I have seen the day view for 2026-10-12
      And the network connection is lost
      And I expand the task list "Groceries"
      And I tick the item "Milk"
      When I open the app again
      And I expand the task list "Groceries"
      Then the item "Milk" is ticked
      And this device keeps 1 unsent change

    Scenario: The app closed before the changes were sent sends them the next time it opens
      Given the calendar contains a task list "Groceries" on 2026-10-12 with items:
        | item | done |
        | Milk | no   |
      And automatic sync is disabled
      And I have seen the day view for 2026-10-12
      And the network connection is lost
      And I expand the task list "Groceries"
      And I tick the item "Milk"
      When I close the app
      And the network connection is restored
      And I open the app
      And I wait until the changes are sent
      Then this device keeps no unsent changes
      And the server has the task list "Groceries" with items:
        | item | done |
        | Milk | yes  |

    Scenario: An unreachable Google keeps the change and it is sent when Google is back
      Given the calendar contains a task list "Groceries" on 2026-10-12 with items:
        | item | done |
        | Milk | no   |
      And automatic sync runs every 2 seconds
      And I have seen the day view for 2026-10-12
      And Google becomes unavailable
      When I expand the task list "Groceries"
      And I tick the item "Milk"
      Then the item "Milk" is ticked
      When Google becomes available again
      And I wait until the changes are sent
      Then the server has the task list "Groceries" with items:
        | item | done |
        | Milk | yes  |

    Scenario: After 5 minutes without a successful sync the sync failed icon shows what is not synced
      Given the calendar contains a task list "Groceries" on 2026-10-12 with items:
        | item | done |
        | Milk | no   |
      And automatic sync is disabled
      And the time is 2026-10-12 08:12 and the clock is running
      And I have seen the day view for 2026-10-12
      And the network connection is lost
      And I expand the task list "Groceries"
      And I tick the item "Milk"
      When 4 minutes pass
      Then I do not see the sync failed icon
      When 1 minute passes
      Then I see the sync failed icon
      And I do not see the sync error banner
      When I tap the sync failed icon
      Then I am told the last successful sync was at "08:12"
      And the unsent changes list shows "Milk ticked"
      When the network connection is restored
      And I wait until the changes are sent
      Then I do not see the sync failed icon
      And the server has the task list "Groceries" with items:
        | item | done |
        | Milk | yes  |

    Scenario: An unreachable Google for 5 minutes shows the sync failed icon too
      Given the calendar contains an event "Dentist" on 2026-10-13 from 10:00 to 11:00
      And automatic sync runs every 30 seconds
      And the time is 2026-10-12 08:12 and the clock is running
      And I have seen the week view for 2026-10-12
      And Google becomes unavailable
      When 5 minutes pass
      Then I see the sync failed icon
      When Google becomes available again
      And I wait for the automatic sync
      Then I do not see the sync failed icon

    Scenario: With nothing to send the icon still shows after 5 minutes of failing syncs and says so
      Given the calendar contains an event "Dentist" on 2026-10-13 from 10:00 to 11:00
      And automatic sync runs every 30 seconds
      And the time is 2026-10-12 08:12 and the clock is running
      And I have seen the week view for 2026-10-12
      And the network connection is lost
      When 5 minutes pass
      Then I see the sync failed icon
      When I tap the sync failed icon
      Then I am told the last successful sync was at "08:12"
      And the unsent changes list is empty

  Rule: When the same thing was changed elsewhere meanwhile, the last change wins and nothing is lost silently

    Scenario: A change to one field is applied on top of a change to another field made elsewhere
      Given the calendar contains an event "Dentist" on 2026-10-13 from 10:00 to 11:00
      And automatic sync is disabled
      And I have seen the week view for 2026-10-12
      And the network connection is lost
      And I open the event "Dentist"
      And I fill in the event form with:
        | title | Dentist Meyer |
      And I save the event
      And Google moves the event "Dentist" to 2026-10-13 from 11:00 to 12:00
      When the network connection is restored
      And I wait until the changes are sent
      Then the event "Dentist Meyer" is positioned on 2026-10-13 from 11:00 to 12:00
      And the server has the event "Dentist Meyer" on 2026-10-13 from 11:00 to 12:00
      And I am not told that a change was not saved

    Scenario: Ticks of different items made on two sides are both kept
      Given the calendar contains a task list "Groceries" on 2026-10-12 with items:
        | item | done |
        | Milk | no   |
        | Eggs | no   |
      And automatic sync is disabled
      And I have seen the day view for 2026-10-12
      And the network connection is lost
      And I expand the task list "Groceries"
      And I tick the item "Milk"
      And Google ticks the item "Eggs" in the task list "Groceries"
      When the network connection is restored
      And I wait until the changes are sent
      Then the item "Milk" is ticked
      And the item "Eggs" is ticked
      And the server has the task list "Groceries" with items:
        | item | done |
        | Milk | yes  |
        | Eggs | yes  |

    Scenario: The same field changed on two devices offline: the change sent last wins on both
      Given the calendar contains an event "Dentist" on 2026-10-13 from 10:00 to 11:00
      And automatic sync is disabled
      And I have seen the week view for 2026-10-12
      And the app is open on a second device
      And the network connection is lost
      And I open the event "Dentist"
      And I fill in the event form with:
        | title | Dentist A |
      And I save the event
      When I switch to the second device
      And the network connection is lost
      And I open the event "Dentist"
      And I fill in the event form with:
        | title | Dentist B |
      And I save the event
      And I switch back to the first device
      And the network connection is restored
      And I wait until the changes are sent
      Then the server has the event "Dentist A" on 2026-10-13 from 10:00 to 11:00
      When I switch to the second device
      And the network connection is restored
      And I wait until the changes are sent
      Then I see the event "Dentist B" on 2026-10-13
      And the server has the event "Dentist B" on 2026-10-13 from 10:00 to 11:00
      When I switch back to the first device
      Then within a second I see the event "Dentist B" on 2026-10-13
      And I do not see the event "Dentist A"
      And I am not told that a change was not saved

    Scenario: A change to something deleted elsewhere is not saved and I am told
      Given the calendar contains an event "Dentist" on 2026-10-13 from 10:00 to 11:00
      And automatic sync is disabled
      And I have seen the week view for 2026-10-12
      And the network connection is lost
      And I open the event "Dentist"
      And I fill in the event form with:
        | title | Dentist Meyer |
      And I save the event
      And Google deletes the event "Dentist"
      When the network connection is restored
      And I wait until the changes are sent
      Then I am told that the change to "Dentist Meyer" was not saved because it was deleted elsewhere
      And I do not see the event "Dentist Meyer"
      And this device keeps no unsent changes
      When I press Edit again in the notice
      Then the event form shows:
        | title | Dentist Meyer |
      When I cancel the event dialog
      And I dismiss the notice
      Then I am not told that a change was not saved

    Scenario: A tick in a task list deleted elsewhere is not saved and I am told
      Given the calendar contains a task list "Groceries" on 2026-10-12 with items:
        | item | done |
        | Milk | no   |
      And automatic sync is disabled
      And I have seen the day view for 2026-10-12
      And the network connection is lost
      And I expand the task list "Groceries"
      And I tick the item "Milk"
      And Google deletes the task list "Groceries"
      When the network connection is restored
      And I wait until the changes are sent
      Then I am told that the change to "Milk" was not saved because it was deleted elsewhere
      And the notice offers no Edit again
      And I do not see the task list "Groceries"

    Scenario: A deletion wins over a change made elsewhere
      Given the calendar contains an event "Dentist" on 2026-10-13 from 10:00 to 11:00
      And automatic sync is disabled
      And I have seen the week view for 2026-10-12
      And the network connection is lost
      And I open the event "Dentist"
      And I delete the event
      And the undo time is over
      And Google renames the event "Dentist" to "Dentist Meyer"
      When the network connection is restored
      And I wait until the changes are sent
      Then I do not see the event "Dentist Meyer"
      And the server has no event "Dentist Meyer"
      And I am not told that a change was not saved

    Scenario: A change the server refuses is undone on this device and I am told
      Given the calendar contains an event "Dentist" on 2026-10-13 from 10:00 to 11:00
      And automatic sync is disabled
      And I have seen the week view for 2026-10-12
      And the network connection is lost
      And I open the event "Dentist"
      And I fill in the event form with:
        | title | Dentist Meyer |
      And I save the event
      And the server refuses the next change as invalid
      When the network connection is restored
      And I wait until the changes are sent
      Then I am told that the change to "Dentist Meyer" was not saved because the server refused it
      And the event "Dentist" is positioned on 2026-10-13 from 10:00 to 11:00
      And I do not see the event "Dentist Meyer"
      And this device keeps no unsent changes
      When I press Edit again in the notice
      Then the event form shows:
        | title | Dentist Meyer |

    Scenario: A refused change does not hold back the changes after it
      Given the calendar contains a task list "Groceries" on 2026-10-12 with items:
        | item | done |
        | Milk | no   |
        | Eggs | no   |
      And automatic sync is disabled
      And I have seen the day view for 2026-10-12
      And the network connection is lost
      And I expand the task list "Groceries"
      And I tick the item "Milk"
      And I tick the item "Eggs"
      And the server refuses the next change as invalid
      When the network connection is restored
      And I wait until the changes are sent
      Then I am told that the change to "Milk" was not saved because the server refused it
      And the notice offers no Edit again
      And the item "Milk" is not ticked
      And the item "Eggs" is ticked
      And the server has the task list "Groceries" with items:
        | item | done |
        | Milk | no   |
        | Eggs | yes  |

  Rule: The outbox belongs to the person who made the changes and survives an expired session

    @signin
    Scenario: An expired session keeps the changes and sends them after the same person signs in again
      Given "jo@example.com" may use the calendar
      And "jo@example.com" has an undated task list "Groceries" with the items "Milk, Eggs"
      And "jo@example.com" is signed in
      And automatic sync is disabled
      And I open the Tasks view
      And the app has synced this device
      And their session expires
      When I tick the item "Milk" of the task list "Groceries" in the Tasks view
      Then they are asked to sign in with Google again
      And this device keeps 1 unsent change
      When they sign in with Google again
      And I wait until the changes are sent
      Then the item "Milk" of the task list "Groceries" in the Tasks view is ticked
      And the server has the task list "Groceries" with items:
        | item | done |
        | Milk | yes  |
        | Eggs | no   |

    @signin
    Scenario: Signing out asks first while changes are not synced yet
      Given "jo@example.com" may use the calendar
      And "jo@example.com" has an undated task list "Groceries" with the items "Milk, Eggs"
      And "jo@example.com" is signed in
      And automatic sync is disabled
      And I open the Tasks view
      And the app has synced this device
      And the network connection is lost
      And I tick the item "Milk" of the task list "Groceries" in the Tasks view
      When they ask to sign out in the settings
      Then they are asked whether to sign out and lose 1 unsent change
      When they choose to stay signed in
      Then this device keeps 1 unsent change
      When they ask to sign out in the settings
      And they sign out anyway
      Then they see the sign-in page
      And this device keeps no last known calendar
      And this device keeps no unsent changes

  Rule: Other open apps take in a change as soon as it has been sent

    Scenario: A change made offline shows on the other open app within a second of being sent
      Given automatic sync is disabled
      And I have seen the week view for 2026-10-12
      And the app is open on a second device
      And the network connection is lost
      When I click the time slot 10:00 on 2026-10-13
      And I fill in the event form with:
        | title      | Dentist |
        | start time | 10:00   |
        | end time   | 11:00   |
      And I save the event
      Then the second device does not show the event "Dentist"
      When the network connection is restored
      Then within a second the second device shows the event "Dentist" on 2026-10-13
