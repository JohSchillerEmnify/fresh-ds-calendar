@sync @id:background-sync
Feature: Background sync with Google Calendar
  All data comes from the calendar provider (mock Google now, real Google later).
  The app re-fetches the visible range periodically (default every 30 s), when the app regains
  focus or becomes visible, when the network comes back, and on demand (retry).
  Steps starting with "Google ..." change the provider's data directly, as if the change had been
  made in the official Google Calendar app.
  If Google or the network is unreachable, a non-blocking error banner with a retry button is shown
  and the last known data stays usable. The banner says who cannot be reached: Google (the server reports it), at once;
  or the calendar server itself (no answer), only once that has lasted a minute, so a deploy restart goes unnoticed.
  If Google asks the app to slow down, that is not an outage: the last known data stays, with no banner, and the app
  catches up once Google lets it through.

  Background:
    Given the calendar is empty
    And tapping a task list grows it in place
    And today is 2026-10-12
    And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    And the calendar contains a task list "Groceries" on 2026-10-14 with items:
      | item | done |
      | Milk | no   |
      | Eggs | no   |

  Scenario: An event added in Google appears after a reload
    When I open the week view for 2026-10-12
    And Google adds an event "Call mom" on 2026-10-14 from 18:00 to 18:30
    And I reload the page
    Then I see the event "Call mom" on "Wednesday"
    And the event "Call mom" is positioned from 18:00 to 18:30

  Scenario: An event added in Google appears through automatic sync
    Given automatic sync runs every 2 seconds
    When I open the week view for 2026-10-12
    And Google adds an event "Call mom" on 2026-10-14 from 18:00 to 18:30
    And I wait for the automatic sync
    Then I see the event "Call mom" on 2026-10-14

  Scenario: Changes in Google appear when the app regains focus
    Given automatic sync is disabled
    When I open the week view for 2026-10-12
    And Google renames the event "Dentist" to "Orthodontist"
    And the app regains focus
    Then I see the event "Orthodontist" on 2026-10-14
    And I do not see the event "Dentist"

  Scenario: An event moved in Google moves in the app
    Given automatic sync runs every 2 seconds
    When I open the week view for 2026-10-12
    And Google moves the event "Dentist" to 2026-10-16 from 11:00 to 12:00
    And I wait for the automatic sync
    Then I see the event "Dentist" on "Friday"
    And the event "Dentist" is positioned from 11:00 to 12:00
    And I do not see the event "Dentist" on 2026-10-14

  Scenario: An event deleted in Google disappears
    Given automatic sync runs every 2 seconds
    When I open the week view for 2026-10-12
    And Google deletes the event "Dentist"
    And I wait for the automatic sync
    Then I do not see the event "Dentist"

  Scenario: A task list changed in Google is updated in the app
    Given automatic sync runs every 2 seconds
    When I open the day view for 2026-10-14
    And Google ticks the item "Milk" in the task list "Groceries"
    And Google renames the task list "Groceries" to "Shopping"
    And I wait for the automatic sync
    Then the task list "Shopping" shows the done count "1/2"
    And I do not see the task list "Groceries"

  Scenario: A task list added in Google appears in the app
    When I open the day view for 2026-10-15
    And Google adds a task list "Remote list" on 2026-10-15 with items:
      | item  | done |
      | One   | yes  |
      | Two   | no   |
    And I reload the page
    Then the collapsed task list "Remote list" lists the items "One, Two"
    And the task list "Remote list" shows the done count "1/2"

  Scenario: Automatic sync does not collapse an expanded task list or lose a tick
    Given automatic sync runs every 2 seconds
    When I open the day view for 2026-10-14
    And I expand the task list "Groceries"
    And I tick the item "Eggs"
    And I wait for the automatic sync
    Then the task list "Groceries" is expanded
    And the item "Eggs" is ticked

  @offline
  Scenario: Google outage shows a non-blocking error banner saying Google cannot be reached
    Given automatic sync runs every 2 seconds
    When I open the week view for 2026-10-12
    And Google becomes unavailable
    And I wait for the automatic sync
    Then I see the sync error banner saying "Can't reach Google Calendar"
    And I see the event "Dentist" on 2026-10-14
    When I switch to the day view
    Then the day view is shown

  @offline
  Scenario: Retry clears the banner once Google is back
    When I open the week view for 2026-10-12
    And Google becomes unavailable
    And the app regains focus
    Then I see the sync error banner
    When Google becomes available again
    And I retry the sync
    Then I do not see the sync error banner
    And I see the event "Dentist" on 2026-10-14

  @offline
  Scenario: The banner disappears by itself after the next successful sync
    Given automatic sync runs every 2 seconds
    When I open the week view for 2026-10-12
    And Google becomes unavailable
    And I wait for the automatic sync
    Then I see the sync error banner
    When Google becomes available again
    And I wait for the automatic sync
    Then I do not see the sync error banner

  @offline
  Scenario: Opening the app while Google is unavailable shows the banner instead of failing
    Given Google becomes unavailable
    When I open the week view for 2026-10-12
    Then the week view is shown
    And I see the sync error banner

  @offline
  Scenario: Saving an event while Google is unavailable closes the dialog, shows it, and sends it when Google is back
    When I open the week view for 2026-10-12
    And Google becomes unavailable
    And I start creating an event
    And I fill in the event form with:
      | title      | Lunch      |
      | start date | 2026-10-13 |
      | start time | 12:00      |
      | end time   | 13:00      |
    And I save the event
    Then the event dialog is closed
    And I see the event "Lunch" on 2026-10-13
    When Google becomes available again
    And I wait until the changes are sent
    Then I see the event "Lunch" on 2026-10-13
    And this device keeps no unsent changes

  @offline
  Scenario: Ticking an item while Google is unavailable keeps the tick and sends it later
    When I open the day view for 2026-10-14
    And I expand the task list "Groceries"
    And Google becomes unavailable
    And I tick the item "Milk"
    Then the item "Milk" is ticked
    And the task list "Groceries" shows the done count "1/2"
    When Google becomes available again
    And I wait until the changes are sent
    Then the item "Milk" is ticked
    And this device keeps no unsent changes

  @offline
  Scenario: A short loss of the connection to the calendar server shows no banner
    Given automatic sync runs every 30 seconds
    And the time is 2026-10-12 08:12 and the clock is running
    And I have seen the week view for 2026-10-12
    When the network connection is lost
    And the app regains focus
    Then I do not see the sync error banner
    And I see the event "Dentist" on 2026-10-14
    When the network connection is restored
    Then I do not see the sync error banner

  @offline
  Scenario: A longer loss of the connection says the calendar server cannot be reached, not Google
    Given automatic sync runs every 30 seconds
    And the time is 2026-10-12 08:12 and the clock is running
    And I have seen the week view for 2026-10-12
    When the network connection is lost
    And the app regains focus
    And 2 minutes pass
    And the app regains focus
    Then I see the sync error banner saying "Can't reach the calendar server"
    And I see the event "Dentist" on 2026-10-14
    When the network connection is restored
    Then I do not see the sync error banner

  Rule: When Google asks the app to slow down, the calendar stays as it was, without an error, and catches up afterwards

    Scenario: While Google asks the app to slow down, I keep seeing my calendar without an error
      Given automatic sync runs every 2 seconds
      And I open the week view for 2026-10-12
      When Google asks the app to slow down for the next sync
      Then I see the event "Dentist" on 2026-10-14
      And I do not see the sync error banner

    Scenario: Once Google lets the app through again, a change made in the meantime appears
      Given automatic sync runs every 2 seconds
      And I open the week view for 2026-10-12
      And Google asks the app to slow down for the next sync
      When Google adds an event "Call mom" on 2026-10-14 from 18:00 to 18:30
      Then once the slow-down is over I see the event "Call mom" on 2026-10-14
