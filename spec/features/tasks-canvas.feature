@tasklists @tasks-canvas @id:tasks-canvas
Feature: The Canvas places task lists as sticky notes
  The Tasks view has three tabs, Open, Canvas and Archive. The Canvas shows every open task list, dated or not, as a
  sticky note on a large board you can pan and zoom. A note shows the title, the category colour, the date (when it has
  one) and its items with checkboxes; ticking works right on the note, and a finished list leaves the canvas for the
  Archive. A note is picked up by a long press anywhere on it (a plain drag with a mouse) and its place is saved on the
  task list itself, so it is the same on every device. A long press on an area moves it too; releasing it without moving
  shows big resize handles on its corners, as for the calendar's events.
  Lists that have no place yet sit in an "Unsorted" stack at the top left. Areas are named, coloured rectangles you
  create, move, resize and delete; a note belongs to an area purely by where it lies. Areas are kept per person.

  Background:
    Given the calendar is empty
    And today is 2026-10-12

  Scenario: The Canvas shows my open lists as notes
    Given the calendar contains an undated task list "Taxes" with items:
      | item | done |
      | Form | no   |
    And the calendar contains a task list "Dentist call" on 2026-10-14 with items:
      | item  | done |
      | Dial  | no   |
      | Wait  | no   |
    And the calendar contains a task list "Old" finished on 2026-10-08
    When I open the Canvas
    Then the Canvas shows the notes "Dentist call, Taxes"
    And the note "Dentist call" shows the date 2026-10-14
    And the note "Dentist call" shows the items "Dial, Wait"

  Scenario: A moved note keeps its place after a reload and on another device
    Given the calendar contains an undated task list "Taxes" with items:
      | item | done |
      | Form | no   |
    When I open the Canvas
    And I move the note "Taxes" to 100, 260 on the Canvas
    And I reload the page
    And I open the Canvas
    Then the note "Taxes" is at 100, 260 on the Canvas
    When I switch to another device
    And I open the Canvas
    Then the note "Taxes" is at 100, 260 on the Canvas

  Scenario: A new list lands in the Unsorted stack
    Given the calendar contains an undated task list "Taxes" with items:
      | item | done |
      | Form | no   |
    When I open the Canvas
    And I move the note "Taxes" to 100, 260 on the Canvas
    And I create the task list "Passport" in the Tasks view
    Then the note "Passport" is in the Unsorted stack
    And the note "Taxes" is not in the Unsorted stack

  Scenario: Ticking the last item on a note moves the list to the Archive
    Given the calendar contains an undated task list "Taxes" with items:
      | item | done |
      | Form | no   |
    When I open the Canvas
    And I tick the item "Form" of the note "Taxes" on the Canvas
    Then the Canvas does not show the note "Taxes"
    And the Archive lists "Taxes"

  Scenario: Creating an area and moving a note into it
    Given the calendar contains an undated task list "Taxes" with items:
      | item | done |
      | Form | no   |
    When I open the Canvas
    And I create the area "Haus" on the Canvas
    And I move the note "Taxes" into the area "Haus" on the Canvas
    Then the note "Taxes" is in the area "Haus"

  Scenario: Areas follow me to another device
    When I open the Canvas
    And I create the area "Haus" on the Canvas
    And I switch to another device
    And I open the Canvas
    Then the Canvas shows the area "Haus"

  @mobile
  Scenario: A long press anywhere on a note picks it up
    Given the calendar contains an undated task list "Taxes" with items:
      | item | done |
      | Form | no   |
    When I open the Canvas
    And I long-press the note "Taxes" on its first item and drag it to 100, 260
    Then the note "Taxes" is at 100, 260 on the Canvas
    And the item "Form" of the note "Taxes" is not ticked

  @mobile
  Scenario: A long press on an item row picks up the note
    Given the calendar contains an undated task list "Taxes" with items:
      | item  | done |
      | Form  | no   |
      | Stamp | no   |
    When I open the Canvas
    And the page is a little taller than the screen
    And I long-press the item "Stamp" of the note "Taxes" and drag the note to 100, 260
    Then the note "Taxes" is at 100, 260 on the Canvas
    And the item "Stamp" of the note "Taxes" is not ticked

  @mobile
  Scenario: A long press on an item's checkbox picks up the note without ticking it
    Given the calendar contains an undated task list "Taxes" with items:
      | item  | done |
      | Form  | no   |
      | Stamp | no   |
    When I open the Canvas
    And I long-press the checkbox of the item "Stamp" of the note "Taxes" and drag the note to 100, 260
    Then the note "Taxes" is at 100, 260 on the Canvas
    And the item "Stamp" of the note "Taxes" is not ticked

  @mobile
  Scenario: A drag on a note without a long press does nothing
    Given the calendar contains an undated task list "Taxes" with items:
      | item | done |
      | Form | no   |
    When I open the Canvas
    And I swipe across the note "Taxes" on the Canvas
    Then the note "Taxes" is in the Unsorted stack
    And the Canvas is panned to 0, 0

  Scenario: Releasing a long-pressed area without moving shows resize handles
    When I open the Canvas
    And I create the area "Haus" on the Canvas
    And I tap the empty Canvas
    Then the area "Haus" shows no resize handles
    When I long-press the area "Haus" and release without moving
    Then the area "Haus" shows resize handles
    When I drag the bottom right handle of the area "Haus" by 20, 40 pixels
    Then the area "Haus" is 340 wide and 280 high
    When I tap the empty Canvas
    Then the area "Haus" shows no resize handles

  @mobile
  Scenario: The add button never covers the area editor
    When I open the Canvas
    And I add an area on the Canvas
    Then the add button covers no control of the area editor

  @desktop
  Scenario: Zoom with Ctrl+wheel, pan the background and keep the view
    Given the calendar contains an undated task list "Taxes" with items:
      | item | done |
      | Form | no   |
    When I open the Canvas
    And I pan the Canvas by -120, -60 pixels
    Then the Canvas is panned to -120, -60
    When I zoom the Canvas in with Ctrl+wheel
    Then the Canvas zoom is above 1
    When I reload the page
    And I open the Canvas
    Then the Canvas zoom is above 1
