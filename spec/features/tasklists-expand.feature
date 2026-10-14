@tasklists @expand-card @id:tasklists-expand-card
Feature: A task list card grows in place over the calendar
  A task list card is only as tall as its time block, so a long list was cut off (owner, 2026-10-14). Tapping the card
  makes the card itself grow in the same view: same left, top and width (its column), same colour, border and font, the
  title wrapping instead of being cut, all items listed (the part over the list's real time block looks exactly like the
  normal card; the part that only extends it is slimmer and lighter, with a seam at the real end, so the real duration
  stays recognisable; growing upwards, the same holds above the real start), and it lies over the following events or slots without moving
  them. The grown card is read-only in every view (done markers, no checkboxes, no edit or close button); a tap anywhere
  on it, items included, opens the normal list sheet, where items are ticked and the list is edited. Tapping elsewhere or
  Escape collapses it; so does a change of view or date, expanding another card, or the sheet opening. One card grows at
  a time and nothing is stored. A long press keeps its meaning (pick up, resize handles). On the phone's month view a tap
  on a card still opens the day (the cells are too small to hold a card).

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And the calendar contains a task list "Groceries" on 2026-10-14 at 09:00 for 30 minutes with items:
      | item   | done |
      | Milk   | yes  |
      | Eggs   | no   |
      | Bread  | no   |
      | Butter | no   |
      | Cheese | no   |
      | Apples | no   |
      | Rice   | no   |
      | Salt   | no   |
    And the calendar contains an event "Standup" on 2026-10-14 from 09:30 to 10:30

  Scenario: The card grows in place over the full width of its day column, over the next event
    When I open the day view for 2026-10-14
    And I note where the task list cards are
    And I note where the event "Standup" is
    Then the task list card "Groceries" is still the one-row inline card of its time block
    When I tap the task list "Groceries"
    Then the task list "Groceries" is expanded over the calendar
    And the expanded task list has the left and width of the day column of "Groceries"
    And the expanded task list items are "Milk, Eggs, Bread, Butter, Cheese, Apples, Rice, Salt"
    And the expanded task list shows the real time block of the card "Groceries" and a slimmer extension starting at its end
    And the expanded task list fits within the viewport
    And the expanded task list overlaps the event "Standup"
    And the event "Standup" has not moved
    And the task list cards have not moved
    And the task list card "Groceries" is still the one-row inline card of its time block

  Scenario: A long title wraps and stays fully readable in the grown card
    Given the calendar contains a task list "Weekly shopping for the big family barbecue" on 2026-10-15 at 11:00 for 30 minutes with items:
      | item | done |
      | Milk | no   |
    When I open the week view for 2026-10-12
    And I tap the task list "Weekly shopping for the big family barbecue"
    Then the task list "Weekly shopping for the big family barbecue" is expanded over the calendar
    And the expanded task list has the left and width of the day column of "Weekly shopping for the big family barbecue"
    And the expanded task list shows the full title "Weekly shopping for the big family barbecue"

  Scenario: A task list beside an overlapping event grows over the full column width, the event included
    Given the calendar contains an event "Abend zu zweit" on 2026-10-14 from 09:00 to 10:00
    When I open the week view for 2026-10-12
    Then the task list card "Groceries" is narrower than its day column
    When I tap the task list "Groceries"
    Then the task list "Groceries" is expanded over the calendar
    And the expanded task list has the left and width of the day column of "Groceries"
    And the expanded task list shows the full title "Groceries"
    And the expanded task list overlaps the event "Abend zu zweit"

  @mobile
  Scenario: The grown card shows no scrollbars and never overflows sideways
    Given the calendar contains an event "Abend zu zweit" on 2026-10-14 from 09:00 to 10:00
    When I open the week view for 2026-10-12
    And I tap the task list "Groceries"
    Then the task list "Groceries" is expanded over the calendar
    And the expanded task list has no scrollbars and no sideways overflow

  Scenario: The grown card is read-only in the day view too
    When I open the day view for 2026-10-14
    And I tap the task list "Groceries"
    Then the task list "Groceries" is expanded over the calendar
    And the expanded task list shows the item "Milk" as done and the item "Eggs" as open
    And the expanded task list has no checkboxes

  Scenario: The grown card is read-only in the week view
    When I open the week view for 2026-10-12
    And I tap the task list "Groceries"
    Then the task list "Groceries" is expanded over the calendar
    And the expanded task list items are "Milk, Eggs, Bread, Butter, Cheese, Apples, Rice, Salt"
    And the expanded task list shows the item "Milk" as done and the item "Eggs" as open
    And the expanded task list has no checkboxes

  @desktop
  Scenario: The grown card is read-only in the month view
    When I open the month view for 2026-10
    And I tap the task list "Groceries"
    Then the task list "Groceries" is expanded over the calendar
    And the expanded task list shows the item "Milk" as done and the item "Eggs" as open
    And the expanded task list has no checkboxes
    And the expanded task list fits within the viewport

  @desktop
  Scenario: A task list in the month view grows only to its content
    Given the calendar contains an event "Abend zu zweit" on 2026-10-14 from 17:15 to 21:30
    When I open the month view for 2026-10
    And I tap the task list "Groceries"
    Then the task list "Groceries" is expanded over the calendar
    And the expanded task list is as tall as its content
    And the expanded task list has the left and width of the card "Groceries"
    And the expanded task list has no time extension

  @desktop
  Scenario: The month view shows no time blocks
    Given the calendar contains an event "Abend zu zweit" on 2026-10-14 from 17:15 to 21:30
    When I open the month view for 2026-10
    Then the month view shows no time blocks
    When I tap the task list "Groceries"
    Then the month view shows no time blocks

  @desktop
  Scenario: A task list in the zoom month grows only to its content
    Given the calendar contains an event "Abend zu zweit" on 2026-10-14 from 17:15 to 21:30
    When I open the zoom month for 2026-10-14
    And I zoom the zoom month in until the task list items show
    And I tap the task list "Groceries"
    Then the task list "Groceries" is expanded over the calendar
    And the expanded task list is as tall as its content
    And the expanded task list has no time extension

  Scenario: Tapping an expanded task list opens the list, where items can be ticked
    When I open the day view for 2026-10-14
    And I tap the task list "Groceries"
    And I tap the expanded task list "Groceries"
    Then the task list "Groceries" opens as the list sheet
    When I tick the item "Eggs"
    Then the item "Eggs" is ticked
    And the task list "Groceries" shows the done count "2/8"

  Scenario: Tapping the title of an expanded task list collapses it
    When I open the day view for 2026-10-14
    And I tap the task list "Groceries"
    And I tap the title of the expanded task list
    Then the task list "Groceries" is collapsed
    And no list sheet is open

  Scenario: The first item is clear of the header and the card's top edge
    When I open the day view for 2026-10-14
    And I tap the task list "Groceries"
    Then the expanded task list has its first item below the header

  Scenario: The grown card scrolls with the time grid
    When I open the day view for 2026-10-14
    And I tap the task list "Groceries"
    Then the expanded task list keeps its offset to the card "Groceries" when the grid scrolls by 40 px

  Scenario: A tap on an item row of the grown card opens the list and changes nothing
    When I open the day view for 2026-10-14
    And I tap the task list "Groceries"
    And I tap the item "Eggs" of the expanded task list
    Then the task list "Groceries" opens as the list sheet
    And the item "Eggs" is not ticked
    And the task list "Groceries" shows the done count "1/8"

  Scenario: Long press on a task list still does what it did
    Given the task list "Groceries" shows resize handles in the day view for 2026-10-14
    Then no task list is expanded

  Scenario: Tapping elsewhere collapses it
    When I open the day view for 2026-10-14
    And I tap the task list "Groceries"
    And I tap outside the expanded task list
    Then the task list "Groceries" is collapsed

  Scenario: Escape collapses it and gives the focus back to the card
    When I open the day view for 2026-10-14
    And I tap the task list "Groceries"
    Then the focus is inside the expanded task list
    And the card of the task list "Groceries" says it is expanded
    When I press Escape
    Then the task list "Groceries" is collapsed
    And the card of the task list "Groceries" has the focus
    And the card of the task list "Groceries" says it is collapsed

  Scenario: Changing the period collapses it
    When I open the day view for 2026-10-14
    And I tap the task list "Groceries"
    And I go to the next period
    Then no task list is expanded

  Scenario: Only one task list is expanded at a time
    Given the calendar contains a task list "Laundry" on 2026-10-14 at 15:00 for 30 minutes with items:
      | item   | done |
      | Wash   | no   |
      | Fold   | no   |
    When I open the day view for 2026-10-14
    And I tap the task list "Groceries"
    And I tap the task list "Laundry"
    Then the task list "Laundry" is expanded
    And the task list "Groceries" is collapsed

  @mobile @expand-zoom
  Scenario: Zooming with the grown card open keeps one card, on its time block
    Given the calendar contains an event "Abend zu zweit" on 2026-10-14 from 09:00 to 10:00
    When I open the week view for 2026-10-12
    And I tap the task list "Groceries"
    And I zoom the time grid in
    Then the task list "Groceries" is expanded over the calendar
    And the real time block of the expanded task list matches the card "Groceries"
    When I zoom the time grid out
    Then the real time block of the expanded task list matches the card "Groceries"

  @expand-zoom
  Scenario: A card that already shows everything opens the list directly
    Given the calendar contains a task list "Short" on 2026-10-14 at 13:00 for 120 minutes with items:
      | item | done |
      | Tea  | no   |
    When I open the day view for 2026-10-14
    And I tap the task list "Short"
    Then the task list "Short" opens as the list sheet
    And no task list is expanded

  @expand-zoom
  Scenario: A card as wide as its column whose items are cut only grows taller
    When I open the day view for 2026-10-14
    And I tap the task list "Groceries"
    Then the task list "Groceries" is expanded over the calendar
    And the expanded task list has the left and width of the card "Groceries"

  @mobile
  Scenario: The add button never covers the grown task list
    When I open the day view for 2026-10-14
    And I tap the task list "Groceries"
    Then the add button covers no control of the "expanded task list"
