@events @crud @id:event-editing
Feature: Creating, editing and deleting events
  Events are created with the floating "+" button (or by tapping an empty time slot, or drawing a block on the grid),
  edited by opening them, and deleted from the edit dialog after confirmation.
  On phones the dialog is a bottom sheet; on desktop it is a centered modal.
  Every change is written to Google Calendar through the server.

  Background:
    Given the calendar is empty
    And today is 2026-10-12

  @ci
  Scenario: Create a timed event with the add button
    When I open the week view for 2026-10-12
    And I start creating an event
    And I fill in the event form with:
      | title      | Dentist    |
      | start date | 2026-10-14 |
      | start time | 09:00      |
      | end time   | 10:00      |
    And I save the event
    Then the event dialog is closed
    And I see the event "Dentist" on "Wednesday"
    And the event "Dentist" is positioned from 09:00 to 10:00
    And Google contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00

  Scenario: A created event is still there after a reload
    When I open the week view for 2026-10-12
    And I start creating an event
    And I fill in the event form with:
      | title      | Dentist    |
      | start date | 2026-10-14 |
      | start time | 09:00      |
      | end time   | 10:00      |
    And I save the event
    And I reload the page
    Then I see the event "Dentist" on 2026-10-14

  Scenario: The new event form is prefilled with the next full hour of today
    Given the time is 2026-10-12 14:20
    When I open the week view for 2026-10-12
    And I start creating an event
    Then the event form shows:
      | title      |            |
      | all day    | no         |
      | start date | 2026-10-12 |
      | start time | 15:00      |
      | end date   | 2026-10-12 |
      | end time   | 16:00      |
      | calendar   | Personal   |

  Scenario: The new event form uses 09:00 on the focused day when it is not today
    When I open the day view for 2026-10-20
    And I start creating an event
    Then the event form shows:
      | start date | 2026-10-20 |
      | start time | 09:00      |
      | end time   | 10:00      |

  @week @day
  Scenario: Tapping an empty time slot starts an event at that hour
    When I open the day view for 2026-10-14
    And I click the time slot 14:00 on 2026-10-14
    Then the event dialog is open
    And the event form shows:
      | start date | 2026-10-14 |
      | start time | 14:00      |
      | end time   | 15:00      |

  Scenario: Changing the start time keeps the event duration
    When I open the day view for 2026-10-14
    And I start creating an event
    And I fill in the event form with:
      | start time | 09:00 |
      | end time   | 10:30 |
    And I fill in the event form with:
      | start time | 11:00 |
    Then the event form shows:
      | end time | 12:30 |

  Scenario: Create an all-day event
    When I open the month view for 2026-10
    And I start creating an event
    And I fill in the event form with:
      | title      | Holiday    |
      | all day    | yes        |
      | start date | 2026-10-16 |
      | end date   | 2026-10-16 |
    And I save the event
    Then I see the all-day event "Holiday" on 2026-10-16
    And Google contains an all-day event "Holiday" from 2026-10-16 to 2026-10-16

  Scenario: Tapping the text "All day" turns the All day setting on
    When I open the month view for 2026-10
    And I start creating an event
    And I tap the text "All day" in the event form
    Then the event form shows:
      | all day | yes |
    When I tap the text "All day" in the event form
    Then the event form shows:
      | all day | no |

  Scenario: Create a multi-day all-day event
    When I open the month view for 2026-10
    And I start creating an event
    And I fill in the event form with:
      | title      | Trip       |
      | all day    | yes        |
      | start date | 2026-10-17 |
      | end date   | 2026-10-20 |
    And I save the event
    Then I see the event "Trip" on each day from 2026-10-17 to 2026-10-20
    And Google contains an all-day event "Trip" from 2026-10-17 to 2026-10-20

  Scenario: Create a timed event spanning two days
    When I open the week view for 2026-10-12
    And I start creating an event
    And I fill in the event form with:
      | title      | Night shift |
      | start date | 2026-10-14  |
      | start time | 22:00       |
      | end date   | 2026-10-15  |
      | end time   | 02:00       |
    And I save the event
    Then I see the event "Night shift" on each day from 2026-10-14 to 2026-10-15

  Scenario: Create an event with description, location and calendar
    When I open the week view for 2026-10-12
    And I start creating an event
    And I fill in the event form with:
      | title       | Team sync        |
      | start date  | 2026-10-13       |
      | start time  | 10:00            |
      | end time    | 11:00            |
      | description | Quarterly review |
      | location    | Room 4           |
      | calendar    | Work             |
    And I save the event
    Then the event "Team sync" has the color "#0b8043"
    And the Google event "Team sync" has:
      | calendarId  | work             |
      | description | Quarterly review |
      | location    | Room 4           |
    When I open the event "Team sync"
    Then the event form shows:
      | title       | Team sync        |
      | description | Quarterly review |
      | location    | Room 4           |
      | calendar    | Work             |

  @validation
  Scenario Outline: Invalid events cannot be saved
    When I open the week view for 2026-10-12
    And I start creating an event
    And I fill in the event form with:
      | title      | <title>      |
      | start date | 2026-10-14   |
      | start time | <start time> |
      | end date   | <end date>   |
      | end time   | <end time>   |
    And I save the event
    Then the event dialog shows the error "<error>"
    And the event dialog is open
    And Google contains no event "<title>"

    Examples:
      | title   | start time | end date   | end time | error                   |
      | Broken  | 10:00      | 2026-10-14 | 09:00    | End must be after start |
      | Zero    | 10:00      | 2026-10-14 | 10:00    | End must be after start |
      | Earlier | 10:00      | 2026-10-13 | 11:00    | End must be after start |

  @validation
  Scenario Outline: An event needs a non-blank title
    When I open the week view for 2026-10-12
    And I start creating an event
    And I fill in the event form with:
      | title      | <title>    |
      | start date | 2026-10-14 |
      | start time | 10:00      |
      | end time   | 11:00      |
    And I save the event
    Then the event dialog shows the error "Title is required"
    And the event dialog is open

    Examples:
      | title |
      |       |
      | "   " |

  @validation
  Scenario: An all-day event cannot end before it starts
    When I open the month view for 2026-10
    And I start creating an event
    And I fill in the event form with:
      | title      | Backwards  |
      | all day    | yes        |
      | start date | 2026-10-16 |
      | end date   | 2026-10-15 |
    And I save the event
    Then the event dialog shows the error "End must be after start"
    And Google contains no event "Backwards"

  @validation
  Scenario: A too long title is rejected
    When I open the week view for 2026-10-12
    And I start creating an event
    And I fill in the event form with:
      | title      | <201 characters> |
      | start date | 2026-10-14       |
      | start time | 10:00            |
      | end time   | 11:00            |
    And I save the event
    Then the event dialog shows the error "Title must be at most 200 characters"

  @cancel
  Scenario: Cancelling the new event dialog creates nothing
    When I open the week view for 2026-10-12
    And I start creating an event
    And I fill in the event form with:
      | title      | Never mind |
      | start date | 2026-10-14 |
      | start time | 09:00      |
      | end time   | 10:00      |
    And I cancel the event dialog
    Then the event dialog is closed
    And I do not see the event "Never mind"
    And Google contains no event "Never mind"

  Scenario: Enter in the title moves to the next field and does not save
    When I open the week view for 2026-10-12
    And I start creating an event
    And I fill in the event form with:
      | title | Dentist |
    And I press Enter in the event field "title"
    Then the event dialog is open
    And the event field "start time" has focus
    And Google contains no event "Dentist"

  Scenario: Enter in the last single-line field moves on to the description, and Enter there adds a line
    When I open the week view for 2026-10-12
    And I start creating an event
    And I fill in the event form with:
      | title    | Dentist |
      | location | Main St |
    And I press Enter in the event field "location"
    And the event field "description" has focus
    And I press Enter in the event field "description"
    Then the event dialog is open
    And Google contains no event "Dentist"

  @cancel
  Scenario: Escape closes the new event dialog without saving
    When I open the week view for 2026-10-12
    And I start creating an event
    And I fill in the event form with:
      | title | Never mind |
    And I press Escape
    Then the event dialog is closed
    And Google contains no event "Never mind"

  Scenario: Edit an event's title and time
    Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    When I open the week view for 2026-10-12
    And I open the event "Dentist"
    Then the event form shows:
      | title      | Dentist    |
      | all day    | no         |
      | start date | 2026-10-14 |
      | start time | 09:00      |
      | end time   | 10:00      |
    When I fill in the event form with:
      | title      | Orthodontist |
      | start time | 11:00        |
      | end time   | 12:00        |
    And I save the event
    Then I see the event "Orthodontist" on 2026-10-14
    And the event "Orthodontist" is positioned from 11:00 to 12:00
    And I do not see the event "Dentist"
    And Google contains an event "Orthodontist" on 2026-10-14 from 11:00 to 12:00
    And Google contains no event "Dentist"

  Scenario: Move an event to another day by editing its date
    Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    When I open the week view for 2026-10-12
    And I open the event "Dentist"
    And I fill in the event form with:
      | start date | 2026-10-16 |
      | end date   | 2026-10-16 |
    And I save the event
    Then I see the event "Dentist" on "Friday"
    And I do not see the event "Dentist" on 2026-10-14

  Scenario: Turn a timed event into an all-day event
    Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    When I open the week view for 2026-10-12
    And I open the event "Dentist"
    And I fill in the event form with:
      | all day | yes |
    And I save the event
    Then I see the all-day event "Dentist" on 2026-10-14
    And Google contains an all-day event "Dentist" from 2026-10-14 to 2026-10-14

  @validation
  Scenario: Editing cannot make the end earlier than the start
    Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    When I open the week view for 2026-10-12
    And I open the event "Dentist"
    And I fill in the event form with:
      | end time | 08:00 |
    And I save the event
    Then the event dialog shows the error "End must be after start"
    And Google contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00

  @cancel
  Scenario: Cancelling an edit leaves the event unchanged
    Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    When I open the week view for 2026-10-12
    And I open the event "Dentist"
    And I fill in the event form with:
      | title | Something else |
    And I cancel the event dialog
    Then I see the event "Dentist" on 2026-10-14
    And I do not see the event "Something else"
    And Google contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00

  Scenario: Delete an event
    Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    When I open the week view for 2026-10-12
    And I open the event "Dentist"
    And I delete the event
    Then the event dialog is closed
    And I do not see the event "Dentist"
    And the snackbar says "Deleted: Dentist"
    When the undo time is over
    Then Google contains no event "Dentist"
    When I reload the page
    Then I do not see the event "Dentist"

  @undo
  Scenario: Undoing a deletion brings the event back
    Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    When I open the week view for 2026-10-12
    And I open the event "Dentist"
    And I delete the event
    And I undo the deletion
    Then I see the event "Dentist" on 2026-10-14
    When the undo time is over
    Then Google contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00

  @month @desktop
  Scenario: Open an event from the desktop month view
    Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    When I open the month view for 2026-10
    And I open the event "Dentist"
    Then the event dialog is open
    And the event form shows:
      | title | Dentist |

  Rule: A tap beside a dialog closes it only while nothing was typed

    Scenario: Tapping beside an untouched dialog closes it
      Given I open the week view for 2026-10-12
      And I start creating an event
      When I tap beside the dialog
      Then the event dialog is closed

    Scenario: Tapping beside a dialog with a typed title keeps it open
      Given I open the week view for 2026-10-12
      And I start creating an event
      And I fill in the event form with:
        | title | Dentist |
      When I tap beside the dialog
      Then the event form shows:
        | title | Dentist |

  # owner, 2026-10-25 (design boards): draw a block on the empty grid to create, like Google Calendar
  Rule: Drawing on the empty time grid opens the new dialog with the drawn start and end

    In the day and week views (not the month view, not the two-row week overview) a block can be drawn on empty grid
    space: on a phone long-press (with a haptic tick) and then drag, as a plain swipe keeps scrolling; with a mouse press
    and drag. Start and end snap to the nearest 15 minutes, the block is at least 15 minutes long and may be drawn
    upwards. In the week view it may reach into the next (or, drawn backwards, the previous) day column: an overnight
    block. On release the new dialog opens with start and end filled in, while the drawn block stays visible behind
    it; Cancel removes the block, saving replaces it with the new entry. A plain tap still opens the dialog at the
    tapped hour with the default length.

    Scenario: Drawing a block in the day view opens the new dialog with its start and end
      When I open the day view for 2026-10-14
      And I draw a block on 2026-10-14 from 09:00 to 10:30
      Then the event dialog is open
      And the event form shows:
        | start date | 2026-10-14 |
        | start time | 09:00      |
        | end date   | 2026-10-14 |
        | end time   | 10:30      |
      And the drawn block is shown on 2026-10-14 from 09:00 to 10:30

    Scenario: The drawn block follows the pointer before it is let go
      When I open the day view for 2026-10-14
      And I hold a drawn block on 2026-10-14 from 13:00 to 14:45
      Then the drawn block is shown on 2026-10-14 from 13:00 to 14:45
      And the event dialog is closed

    Scenario: A drawn block snaps to 15 minutes
      When I open the week view for 2026-10-12
      And I draw a block on 2026-10-14 from 09:07 to 10:22
      Then the event form shows:
        | start time | 09:00 |
        | end time   | 10:15 |

    Scenario: A block drawn upwards runs from where the pointer stopped to where it started
      When I open the day view for 2026-10-14
      And I draw a block on 2026-10-14 from 11:00 to 10:00
      Then the event form shows:
        | start time | 10:00 |
        | end time   | 11:00 |

    Scenario: In the week view a block can be drawn overnight into the next day
      When I open the week view for 2026-10-12
      And I draw a block from 2026-10-14 22:00 to 2026-10-15 01:00
      Then the event form shows:
        | start date | 2026-10-14 |
        | start time | 22:00      |
        | end date   | 2026-10-15 |
        | end time   | 01:00      |
      And the drawn block is shown on 2026-10-14 from 22:00 to 24:00
      And the drawn block is shown on 2026-10-15 from 00:00 to 01:00
      When I fill in the event form with:
        | title | Night train |
      And I save the event
      Then the event "Night train" is positioned on 2026-10-14 from 22:00 to 24:00
      And the event "Night train" is positioned on 2026-10-15 from 00:00 to 01:00
      And Google contains an event "Night train" from 2026-10-14 22:00 to 2026-10-15 01:00

    Scenario: Cancelling the dialog removes the drawn block
      When I open the day view for 2026-10-14
      And I draw a block on 2026-10-14 from 09:00 to 10:30
      And I cancel the event dialog
      Then no drawn block is shown

    Scenario: Saving turns the drawn block into the event
      When I open the day view for 2026-10-14
      And I draw a block on 2026-10-14 from 09:00 to 10:30
      And I fill in the event form with:
        | title | Focus |
      And I save the event
      Then no drawn block is shown
      And the event "Focus" is positioned from 09:00 to 10:30
      And Google contains an event "Focus" on 2026-10-14 from 09:00 to 10:30

    @mobile
    Scenario: On a phone a long press starts drawing with a haptic tick
      Given I am using a phone
      When I open the day view for 2026-10-14
      And I draw a block on 2026-10-14 from 09:00 to 10:30
      Then a haptic tick was requested
      And the event form shows:
        | start time | 09:00 |
        | end time   | 10:30 |

    # owner, 2026-10-25: drawing works on the iPhone too (long press on the empty grid, then drag)
    @iphone
    Scenario: On an iPhone a long press on the empty grid and a drag draw a block
      When I open the day view for 2026-10-14
      And I draw a block on 2026-10-14 from 09:00 to 10:30
      Then the event form shows:
        | start time | 09:00 |
        | end time   | 10:30 |

    # owner, 2026-10-25: what was shown is what opens
    @mobile
    Scenario: On a phone a long press let go without moving opens the 15-minute block it showed
      Given I am using a phone
      When I open the day view for 2026-10-14
      And I long-press the empty time grid on 2026-10-14 at 09:20 and let go
      Then the event form shows:
        | start time | 09:15 |
        | end time   | 09:30 |

    @mobile
    Scenario: On a phone a plain swipe on the empty grid scrolls and draws nothing
      Given I am using a phone
      When I open the day view for 2026-10-14
      And I swipe up on the empty time grid of 2026-10-14
      Then the time grid has scrolled
      And no drawn block is shown
      And the event dialog is closed
