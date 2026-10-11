@sync
Feature: Background sync with Google Calendar
  All data comes from the calendar provider (mock Google now, real Google later).
  The app re-fetches the visible range periodically (default every 30 s), when the app regains
  focus or becomes visible, when the network comes back, and on demand (retry).
  Steps starting with "Google ..." change the provider's data directly, as if the change had been
  made in the official Google Calendar app.
  If Google or the network is unreachable, a non-blocking error banner with a retry button is shown
  and the last known data stays usable.

  Background:
    Given the calendar is empty
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
  Scenario: Google outage shows a non-blocking error banner while browsing
    Given automatic sync runs every 2 seconds
    When I open the week view for 2026-10-12
    And Google becomes unavailable
    And I wait for the automatic sync
    Then I see the sync error banner
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
  Scenario: Saving an event while Google is unavailable keeps the dialog open with an error
    When I open the week view for 2026-10-12
    And Google becomes unavailable
    And I start creating an event
    And I fill in the event form with:
      | title      | Lunch      |
      | start date | 2026-10-13 |
      | start time | 12:00      |
      | end time   | 13:00      |
    And I save the event
    Then the event dialog shows the error "Could not save: Google Calendar is unavailable"
    And the event dialog is open
    And I see the sync error banner
    When Google becomes available again
    And I save the event
    Then the event dialog is closed
    And I see the event "Lunch" on 2026-10-13

  @offline
  Scenario: Ticking an item while Google is unavailable is rolled back
    When I open the day view for 2026-10-14
    And I expand the task list "Groceries"
    And Google becomes unavailable
    And I tick the item "Milk"
    Then I see the sync error banner
    And the item "Milk" is not ticked
    And the task list "Groceries" shows the done count "0/2"

  @offline
  Scenario: Losing the network connection shows the banner, regaining it recovers
    When I open the week view for 2026-10-12
    And the network connection is lost
    And the app regains focus
    Then I see the sync error banner
    When the network connection is restored
    Then I do not see the sync error banner

  @conflict
  Scenario: Editing an event that was changed in Google in the meantime
    Given automatic sync is disabled
    When I open the week view for 2026-10-12
    And Google renames the event "Dentist" to "Orthodontist"
    And I open the event "Dentist"
    And I fill in the event form with:
      | title | Dentist (moved) |
    And I save the event
    Then the event dialog shows the error "This event was changed elsewhere. Reload it and try again."
    When I cancel the event dialog
    And the app regains focus
    Then I see the event "Orthodontist" on 2026-10-14
