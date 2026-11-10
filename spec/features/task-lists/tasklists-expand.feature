@tasklists @expand-card @id:tasklists-expand-card
Feature: A task list card grows in place over the calendar
  A task list card is only as tall as its time block, so a long list was cut off (owner, 2026-10-14). Tapping the card
  makes the card itself grow in the same view: same left, top and width (its column), same colour, border and font, the
  title wrapping instead of being cut, all items listed (the part over the list's real time block looks exactly like the
  normal card; the part that only extends it is slimmer and lighter, with a seam at the real end, so the real duration
  stays recognisable; growing upwards, the same holds above the real start), and it lies over the following events or slots without moving
  them. The grown card is read-only in every view (done markers, no checkboxes, no edit or close button); a tap on its items
  opens the normal list sheet, where items are ticked and the list is edited. Tapping anywhere on its pill (the head row:
  the list's own checkbox, title, time, count, ring), titled or untitled alike, collapses it (owner, 2026-11-10); a tap
  elsewhere in the calendar, Escape, growing another card or a sheet opening
  leave it grown. Several cards may be grown at the same time, each until its own pill is
  tapped (the setting "Keep several lists open", on by default; off, growing a card collapses the one grown before). A tap on
  a grown card's items opens its list sheet and it stays grown behind it. The pill is one button ("Collapse <title>", "Collapse
  task list" without a title): Enter or Space on it collapses the card, Enter on the card opens the sheet like a tap, Escape does nothing. Scrolling or zooming a
  grown card out of sight leaves it grown (it shows again when its card is back in view). A long press keeps its meaning
  (pick up, resize handles). On the phone's month view a tap on a card still opens the day (the cells are too small to hold a
  card).
  The expansion is remembered on this device only, never synced (owner, 2026-11-01): it stays through switching views,
  moving to other periods, going back, reloading and reopening the app, and the card grows again wherever the list
  shows. Taps on the app's bars and menus leave it open, and going back moves between views instead of collapsing it.
  A remembered expansion ends by itself when the list is completed or once the list's day has passed (a list dated
  before today starts collapsed); collapsing it by hand forgets it.

  Background:
    Given the calendar is empty
    And tapping a task list grows it in place
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

  Scenario: The card grows in place, only as wide as its content needs, over the next event
    When I open the day view for 2026-10-14
    And I note where the task list cards are
    And I note where the event "Standup" is
    Then the task list card "Groceries" is still the one-row inline card of its time block
    When I tap the task list "Groceries"
    Then the task list "Groceries" is expanded over the calendar
    And the expanded task list is only as wide as its content needs, within the day column of "Groceries"
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

  Scenario: A task list beside an overlapping event grows only as wide as its content needs
    Given the calendar contains an event "Abend zu zweit" on 2026-10-14 from 09:00 to 10:00
    When I open the week view for 2026-10-12
    Then the task list card "Groceries" is narrower than its day column
    When I tap the task list "Groceries"
    Then the task list "Groceries" is expanded over the calendar
    And the expanded task list is only as wide as its content needs, within the day column of "Groceries"
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

  Scenario: Tapping a titleless list expands it over the calendar in the day view too
    Given the calendar contains a task list "" on 2026-10-14 at 11:00 for 30 minutes with items:
      | item | done |
      | Milk | no   |
    When I open the day view for 2026-10-14
    And I tap the titleless task list
    Then the titleless task list is expanded over the calendar

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

  Scenario: With the setting "inline" a tap grows the card in place
    Given the task list tap setting is "inline"
    When I open the day view for 2026-10-14
    And I tap the task list "Groceries"
    Then the task list "Groceries" is expanded over the calendar

  Scenario: With the setting "drawer" a tap opens the list sheet directly
    Given the task list tap setting is "drawer"
    When I open the day view for 2026-10-14
    And I tap the task list "Groceries"
    Then the task list "Groceries" opens as the list sheet
    And no task list is expanded

  Scenario: Tapping an expanded task list opens the list, where items can be ticked
    When I open the day view for 2026-10-14
    And I tap the task list "Groceries"
    And I tap the expanded task list "Groceries"
    Then the task list "Groceries" opens as the list sheet
    When I tick the item "Eggs"
    Then the item "Eggs" is ticked
    And the task list "Groceries" shows the done count "2/8"

  Scenario: The grown card stays grown behind its list sheet and after it
    When I open the day view for 2026-10-14
    And I tap the task list "Groceries"
    And I tap the expanded task list "Groceries"
    Then the task list "Groceries" opens as the list sheet
    When I collapse the task list
    Then the task list "Groceries" is expanded over the calendar

  Scenario: Enter or Space on the pill collapses it; its name says so
    When I open the day view for 2026-10-14
    And I tap the task list "Groceries"
    Then the pill of the expanded task list "Groceries" is called "Collapse Groceries"
    When I press Enter on the pill of the expanded task list "Groceries"
    Then the task list "Groceries" is collapsed
    When I tap the task list "Groceries"
    And I press Space on the pill of the expanded task list "Groceries"
    Then the task list "Groceries" is collapsed

  Scenario: Enter on the grown card opens its list sheet like a tap
    When I open the day view for 2026-10-14
    And I tap the task list "Groceries"
    And I press Enter on the expanded task list "Groceries"
    Then the task list "Groceries" opens as the list sheet
    When I collapse the task list
    Then the task list "Groceries" is expanded over the calendar

  Scenario: Tapping the title of an expanded task list collapses it
    When I open the day view for 2026-10-14
    And I tap the task list "Groceries"
    And I tap the title of the expanded task list
    Then the task list "Groceries" is collapsed
    And no list sheet is open

  Scenario: Tapping the rest of the pill, away from the title, collapses a titled list
    When I open the day view for 2026-10-14
    And I tap the task list "Groceries"
    And I tap the right end of the pill of the expanded task list
    Then the task list "Groceries" is collapsed
    And no list sheet is open

  Scenario: Tapping the pill of a titleless list collapses it just like a titled one
    Given the calendar contains a task list "" on 2026-10-14 at 11:00 for 30 minutes with items:
      | item | done |
      | Milk | no   |
    When I open the day view for 2026-10-14
    And I tap the titleless task list
    And I tap the right end of the pill of the expanded task list
    Then the titleless task list is collapsed
    And no list sheet is open

  Scenario: Tapping the list's own checkbox in the pill collapses it
    When I open the day view for 2026-10-14
    And I tap the task list "Groceries"
    And I tap the checkbox in the pill of the expanded task list
    Then the task list "Groceries" is collapsed
    And no list sheet is open

  Scenario: The items area of a one-item list is at least 44 px tall, the item centred in it
    Given the calendar contains a task list "Post" on 2026-10-14 at 13:00 for 30 minutes with items:
      | item   | done |
      | Letter | no   |
    When I open the day view for 2026-10-14
    And I tap the task list "Post"
    Then the items area of the expanded task list "Post" is at least 44 px tall
    And the item of the expanded task list "Post" is centred in its items area

  Scenario: The first item of the grown card is below its header
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

  Scenario: A long press shows the resize handles and does not grow the card
    Given the task list "Groceries" shows resize handles in the day view for 2026-10-14
    Then no task list is expanded

  Scenario: Tapping elsewhere keeps it grown
    When I open the day view for 2026-10-14
    And I tap the task list "Groceries"
    And I tap outside the expanded task list
    Then the task list "Groceries" is expanded over the calendar

  Scenario: Escape keeps it grown and the focus stays in it
    When I open the day view for 2026-10-14
    And I tap the task list "Groceries"
    Then the focus is inside the expanded task list
    And the card of the task list "Groceries" says it is expanded
    When I press Escape
    Then the task list "Groceries" is expanded over the calendar
    And the focus is inside the expanded task list

  Scenario: A sheet opening and closing leaves it grown
    Given the calendar contains a task list "Laundry" on 2026-10-14 at 15:00 for 30 minutes with items:
      | item | done |
      | Wash | no   |
      | Fold | no   |
    When I open the day view for 2026-10-14
    And I tap the task list "Groceries"
    And I expand the task list "Laundry"
    Then the task list "Laundry" opens as the list sheet
    And the task list "Groceries" is expanded over the calendar
    When I collapse the task list
    Then the task list "Groceries" is expanded over the calendar

  Scenario: Changing the period hides it until the list's day shows again
    When I open the day view for 2026-10-14
    And I tap the task list "Groceries"
    And I go to the next period
    Then no task list is expanded
    When I go to the previous period
    Then the task list "Groceries" is expanded over the calendar

  Scenario: A second card grows while the first stays grown
    Given the calendar contains a task list "Laundry" on 2026-10-14 at 15:00 for 30 minutes with items:
      | item   | done |
      | Wash   | no   |
      | Fold   | no   |
    When I open the day view for 2026-10-14
    And I tap the task list "Groceries"
    And I tap the task list "Laundry"
    Then the task list "Laundry" is expanded over the calendar
    And the task list "Groceries" is expanded over the calendar
    When I tap the title of the expanded task list "Laundry"
    Then the task list "Laundry" is collapsed
    And the task list "Groceries" is expanded over the calendar

  Scenario: With "Keep several lists open" off, growing another card collapses the one before
    Given keeping several task lists open is "off"
    And the calendar contains a task list "Laundry" on 2026-10-14 at 15:00 for 30 minutes with items:
      | item   | done |
      | Wash   | no   |
      | Fold   | no   |
    When I open the day view for 2026-10-14
    And I tap the task list "Groceries"
    And I tap the task list "Laundry"
    Then the task list "Laundry" is expanded over the calendar
    And the task list "Groceries" is collapsed

  Scenario: Grown cards that overlap: the later one is on top, a tap on the earlier one brings it to the front
    Given the calendar contains a task list "Laundry" on 2026-10-14 at 09:30 for 30 minutes with items:
      | item   | done |
      | Wash   | no   |
      | Fold   | no   |
    When I open the day view for 2026-10-14
    And I tap the task list "Laundry"
    And I tap the task list "Groceries"
    Then the expanded task list "Groceries" and the expanded task list "Laundry" overlap
    And the expanded task list "Laundry" is drawn above the expanded task list "Groceries"
    When I tap the expanded task list "Groceries" above the expanded task list "Laundry"
    Then the expanded task list "Groceries" is drawn above the expanded task list "Laundry"
    And no list sheet is open
    When I tap the expanded task list "Groceries" above the expanded task list "Laundry"
    Then the task list "Groceries" opens as the list sheet

  @expand-zoom
  Scenario: A short list beside a long event does not take the whole day column
    Given the calendar contains a task list "Einkaufen" on 2026-10-14 at 17:00 for 15 minutes with items:
      | item         | done |
      | Kondome      | no   |
      | chips        | no   |
      | suppenlöffel | no   |
      | saft         | no   |
      | butter       | no   |
    And the calendar contains an event "Abend zu zweit" on 2026-10-14 from 17:10 to 22:00
    When I open the day view for 2026-10-14
    And I tap the task list "Einkaufen"
    Then the task list "Einkaufen" is expanded over the calendar
    And the expanded task list is only as wide as its content needs, within the day column of "Einkaufen"
    And the expanded task list is narrower than the day column of "Einkaufen"
    And the expanded task list shows the full title "Einkaufen"

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

  @mobile @expand-zoom
  Scenario: After the grown card closes with its title, one tap grows it again
    When I open the week view for 2026-10-12
    And I tap the task list "Groceries"
    And I tap the title of the expanded task list
    Then the task list "Groceries" is collapsed
    When I tap the task list "Groceries"
    Then the task list "Groceries" is expanded over the calendar

  @mobile @expand-zoom
  Scenario: After a zoom took the card out of sight, it stays grown
    When I open the week view for 2026-10-12
    And I tap the task list "Groceries"
    And I zoom the time grid in far from the grown card
    Then the task list "Groceries" is grown but out of sight
    When I reload the page
    Then the task list "Groceries" is grown but out of sight

  @mobile @expand-zoom
  Scenario: Zooming around the lower edge of the grown card keeps it open on its card
    When I open the week view for 2026-10-12
    And I tap the task list "Groceries"
    And I zoom the time grid in on the lower edge of the grown card
    Then the real time block of the expanded task list matches the card "Groceries"

  @expand-zoom
  Scenario: A card that already shows everything still grows in place
    Given the calendar contains a task list "Short" on 2026-10-14 at 13:00 for 120 minutes with items:
      | item | done |
      | Tea  | no   |
    When I open the day view for 2026-10-14
    And I tap the task list "Short"
    Then the card of the task list "Short" says it is expanded

  @expand-zoom
  Scenario: A card as wide as its column whose items are cut only grows taller
    Given the calendar contains a task list "Pantry" on 2026-10-14 at 15:00 for 30 minutes with items:
      | item   | done |
      | Flour  | no   |
      | Sugar  | no   |
      | Oats   | no   |
      | Rice   | no   |
      | Beans  | no   |
    When I open the day view for 2026-10-14
    And I tap the task list "Pantry"
    Then the task list "Pantry" is expanded over the calendar
    And the expanded task list has the left and width of the card "Pantry"

  @mobile
  Scenario: The add button never covers the grown task list
    When I open the day view for 2026-10-14
    And I tap the task list "Groceries"
    Then the add button covers no control of the "expanded task list"

  @backlog
  Scenario: A list at the end of the day grows upward and keeps its real time block
    Given the calendar contains a task list "Late shop" on 2026-10-14 at 23:30 for 30 minutes with items:
      | item   | done |
      | Milk   | no   |
      | Eggs   | no   |
      | Bread  | no   |
      | Butter | no   |
    When I open the day view for 2026-10-14
    And I tap the task list "Late shop"
    Then the expanded task list shows the real time block of the card "Late shop" and a slimmer extension ending at its start

  Rule: The expansion is remembered on this device

    Scenario: Switching the view keeps the list expanded
      When I open the day view for 2026-10-14
      And I tap the task list "Groceries"
      And I switch to the week view
      Then the task list "Groceries" is expanded over the calendar

    Scenario: Going back to the view keeps the list expanded
      When I open the week view for 2026-10-12
      And I tap the task list "Groceries"
      And I switch to the day view
      And I go back in the browser
      Then the task list "Groceries" is expanded over the calendar

    Scenario: Reloading keeps the list expanded
      When I open the day view for 2026-10-14
      And I tap the task list "Groceries"
      And I reload the page
      Then the task list "Groceries" is expanded over the calendar

    Scenario: The expansion stays on this device
      When I open the day view for 2026-10-14
      And I tap the task list "Groceries"
      And I switch to another device
      And I open the day view for 2026-10-14
      Then no task list is expanded

    Scenario: Every grown list is remembered
      Given the calendar contains a task list "Laundry" on 2026-10-14 at 15:00 for 30 minutes with items:
        | item | done |
        | Wash | no   |
      When I open the day view for 2026-10-14
      And I tap the task list "Groceries"
      And I tap the task list "Laundry"
      And I reload the page
      Then the task list "Laundry" is expanded over the calendar
      And the task list "Groceries" is expanded over the calendar

    Scenario: Collapsing it by its title forgets it
      When I open the day view for 2026-10-14
      And I tap the task list "Groceries"
      And I tap the title of the expanded task list
      And I reload the page
      Then no task list is expanded

    Scenario: A tap elsewhere does not forget it
      When I open the day view for 2026-10-14
      And I tap the task list "Groceries"
      And I tap outside the expanded task list
      And I reload the page
      Then the task list "Groceries" is expanded over the calendar

    Scenario: A remembered list closes by itself once it is completed
      Given the calendar contains a task list "Laundry" on 2026-10-14 at 15:00 for 30 minutes with items:
        | item | done |
        | Wash | yes  |
        | Fold | no   |
      When I open the day view for 2026-10-14
      And I tap the task list "Laundry"
      And I open the Tasks view
      And I tick the item "Fold" of the task list "Laundry" in the Tasks view
      And I open the day view for 2026-10-14
      Then the task list "Laundry" is collapsed

    Scenario: Ticking the last item in the list sheet collapses the grown card and it is forgotten
      Given the calendar contains a task list "Laundry" on 2026-10-14 at 15:00 for 30 minutes with items:
        | item | done |
        | Wash | yes  |
        | Fold | no   |
      When I open the day view for 2026-10-14
      And I tap the task list "Groceries"
      And I tap the task list "Laundry"
      And I tap the expanded task list "Laundry"
      And I tick the item "Fold"
      And I collapse the task list
      Then the task list "Laundry" is collapsed
      And the task list "Groceries" is expanded over the calendar
      When I reload the page
      Then the task list "Laundry" is collapsed
      And the task list "Groceries" is expanded over the calendar

    Scenario: A list completed on another device collapses its grown card and it is forgotten
      Given automatic sync runs every 2 seconds
      And the calendar contains a task list "Laundry" on 2026-10-14 at 15:00 for 30 minutes with items:
        | item | done |
        | Wash | yes  |
        | Fold | no   |
      When I open the day view for 2026-10-14
      And I tap the task list "Groceries"
      And I tap the task list "Laundry"
      And Google ticks the item "Fold" in the task list "Laundry"
      And I wait for the automatic sync
      Then the task list "Laundry" is collapsed
      And the task list "Groceries" is expanded over the calendar
      When I reload the page
      Then the task list "Laundry" is collapsed

    Scenario: A remembered list starts collapsed once its day has passed
      When I open the day view for 2026-10-14
      And I tap the task list "Groceries"
      And today is 2026-10-15
      And I open the day view for 2026-10-15
      Then the task list "Groceries" is collapsed
