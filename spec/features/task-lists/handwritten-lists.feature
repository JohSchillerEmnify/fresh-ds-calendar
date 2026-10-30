@tasklists @labs @handwriting @id:handwritten-lists
Feature: Labs: handwritten lists
  Experimental (Labs, off by default, its own switch in Settings > Labs). I can write the items of a task list by hand
  with a pen (or the mouse). A small switch beside the writing area changes between two ways of writing:
  INK keeps my handwriting as it is, as a picture; TEXT shows ruled ordinary text fields, where the device's own
  handwriting recognition (iPad Scribble, Windows 11 pen input) turns the writing into text on the device. The app has
  no recognition of its own and no button that turns ink into text.
  A list keeps its structure: in ink mode every item is a line of ink in place of a title, and ticking, reordering,
  removing and the done count work as for any item. Writing happens in the open list (sheet or expanded card), in the new
  list form and on Canvas notes; everywhere else (calendar cards, the tray, the Tasks view) ink items are shown
  read-only and scaled down.
  Pen (Apple Pencil, Windows pen, Android stylus, with pressure) and mouse draw; a finger keeps scrolling and tapping; a
  resting palm never draws. Ink is stored on our server per person with a copy on the device (readable offline), is
  backed up with the server's files to Drive, and Google Calendar only gets a placeholder title for an ink item.
  A list shared with another person shares its ink like its items.

  ASSUMPTIONS (the owner has not confirmed them; each is tagged in the scenarios where it matters)
  A1. "Per item": every ink item is one line of ink drawn on its own ruled line (not one page of ink per list).
  A2. Switching the feature off leaves existing ink items visible, read-only and still tickable; they are not deleted.
  A3. An ink item has no title, so Google shows the placeholder "Handwritten item" for it (wording to confirm).
  A4. The writing mode is remembered per device, not per list.
  A5. Items written in TEXT mode are ordinary items; nothing marks them as written by hand.
  A6. "Large device" = a viewport as wide as an iPad (768 px or more) or a desktop that reports pen support.

  OPEN QUESTIONS (no scenario until answered)
  Q1. Undo of the last stroke: wanted? How (a button, a pen double tap, a two-finger tap)? Does it survive closing the
      dialog? Meanwhile the way to correct ink is to remove the ink item and write it again.
  Q2. Eraser: is the pen's eraser end (Apple Pencil has none; Surface pen does) or an eraser button wanted?
  Q3. Does an ink item have a size limit (strokes or bytes), and what is said when it is reached?
  Q4. Ink colour and line width: fixed (follows the theme, dark mode inverts) or chosen?
  Q5. Can one list mix ink items and text items? (assumed yes: the mode decides how the NEXT item is written.)
  Q6. Rename: tapping an ink item rewrites it (replace) or adds strokes (extend)?
  Q7. Lists from templates and repeating lists: do they copy ink items? (assumed yes.)
  Q8. Palm rejection: pen hovering/touching makes touches in the same moment ignored; a finger alone on the writing
      area never draws. Is a finger drawing ever wanted (a switch)? Assumed never.
  Q9. Android phones with a stylus: the dialog stays as on a phone; is that right for a large stylus phone?

  Background:
    Given the calendar is empty
    And today is 2026-10-12

  @backlog
  Scenario: Handwriting is off until switched on in the Labs
    When I open the settings
    Then the Labs switch "Handwritten lists" is off
    When I open the new task list form
    Then the new list form has no writing mode switch

  @backlog
  Scenario: Switching handwriting on shows the writing mode switch
    Given the Labs switch "Handwritten lists" is on
    When I open the new task list form
    Then the new list form shows the writing mode switch with the pen icon

  @backlog
  Scenario: The switch changes between ink and text writing
    Given the Labs switch "Handwritten lists" is on
    And I open the new task list form
    When I press the writing mode switch
    Then the writing mode is "text" and the switch shows the keyboard icon
    When I press the writing mode switch
    Then the writing mode is "ink" and the switch shows the pen icon

  Rule: In ink mode each item is a line of ink instead of a title (assumption A1)

    Background:
      Given the Labs switch "Handwritten lists" is on
      And the calendar contains a task list "Groceries" on 2026-10-14 with the ink items "Milk, Eggs, Bread"
      And I expand the task list "Groceries"

    @backlog
    Scenario: A pen stroke on a ruled line becomes an ink item
      When I write an ink item with the pen
      Then the expanded task list has 4 items
      And the task list "Groceries" shows the done count "0/4"

    @backlog
    Scenario: An ink item is ticked off like any item
      When I tick the item number 2
      Then the item number 2 is ticked
      And the task list "Groceries" shows the done count "1/3"

    @backlog
    Scenario: An ink item is reordered by dragging its handle
      When I drag the item number 3 above the item number 1
      Then the ink items are in the order "Bread, Milk, Eggs"

    @backlog
    Scenario: An ink item is removed
      When I delete the item number 2
      Then the task list "Groceries" shows the done count "0/2"

  Rule: Pen and mouse draw, a finger and a resting palm do not

    Background:
      Given the Labs switch "Handwritten lists" is on
      And the expanded task list "Notes" has more ink items than fit the screen

    @backlog
    Scenario: A pen draws with the pressure of the stroke
      When I draw a stroke with the pen
      Then the stroke is drawn on the line, thicker where I pressed harder

    @desktop @backlog
    Scenario: The mouse draws on a desktop
      When I draw a stroke with the mouse
      Then the stroke is drawn on the line

    @mobile @backlog
    Scenario: A finger scrolls the list instead of drawing
      When I swipe up on the writing area with a finger
      Then the list scrolls
      And nothing is drawn

    @backlog
    Scenario: A resting palm does not draw while the pen writes
      When I rest my palm on the writing area and draw a stroke with the pen
      Then only the pen stroke is drawn

    @backlog
    Scenario: A tap with a finger on an ink item still ticks it
      When I tap the ink item number 1 with a finger
      Then the item number 1 is ticked and nothing is drawn

  Rule: On large devices the list dialog is larger and ruled; on a phone it stays as it is

    Background:
      Given the Labs switch "Handwritten lists" is on

    @tablet @backlog
    Scenario: On a tablet the list dialog is larger and shows ruled lines
      When I open the new task list form on a screen 1024 pixels wide
      Then the dialog is larger than without the feature
      And the dialog shows ruled lines to write on

    @desktop @backlog
    Scenario: A desktop that reports pen support gets the larger ruled dialog
      Given the device reports pen support
      When I open the new task list form
      Then the dialog shows ruled lines to write on

    @desktop @backlog
    Scenario: A desktop without pen support keeps the dialog as it is
      Given the device reports no pen support
      When I open the new task list form
      Then the dialog is as large as without the feature
      And the new list form shows the writing mode switch with the pen icon

    @mobile @backlog
    Scenario: On a phone the dialog is unchanged and the switch is still there
      When I open the new task list form
      Then the dialog is as large as without the feature
      And the new list form shows the writing mode switch with the pen icon

  Rule: In text mode the fields are ordinary text fields the device can recognise writing in

    Background:
      Given the Labs switch "Handwritten lists" is on

    @backlog
    Scenario: Text mode shows ruled plain text fields
      Given the writing mode is "text"
      When I open the new task list form
      Then the item fields are ruled, ordinary text fields
      And the form has no button that turns ink into text

    @backlog
    Scenario: Text written with the device's recognition is saved as items
      Given the writing mode is "text"
      And I open the new task list form
      When the device's handwriting recognition enters the text "Milk" in the item field
      And I save the task list
      Then the collapsed task list shows the items "Milk"

  Rule: Ink is shown read-only and small outside the places where I write

    Background:
      Given the Labs switch "Handwritten lists" is on
      And the calendar contains a task list "Groceries" on 2026-10-14 with the ink items "Milk, Eggs"

    @backlog
    Scenario: A calendar card shows the ink items scaled down
      When I open the day view for 2026-10-14
      Then the card of "Groceries" shows 2 ink items, scaled down
      And a pen stroke on the card draws nothing

    @backlog
    Scenario: The Tasks view shows the ink items read-only
      When I open the Tasks view
      Then the task list "Groceries" shows 2 ink items, scaled down

    @backlog
    Scenario: A Canvas note can be written on
      When I open the Canvas
      And I write an ink item on the note "Groceries" with the pen
      Then the note "Groceries" shows 3 ink items

  Rule: Ink lives on the server per person and on the device

    Background:
      Given the Labs switch "Handwritten lists" is on
      And the calendar contains a task list "Groceries" on 2026-10-14 with the ink items "Milk, Eggs"

    @backlog
    Scenario: Ink is shown without a connection
      Given I have seen the day view for 2026-10-14
      When the network connection is lost
      And I open the app again
      Then the card of "Groceries" shows 2 ink items, scaled down

    @backlog
    Scenario: Ink follows me to another device
      When I switch to another device
      And I open the day view for 2026-10-14
      Then the card of "Groceries" shows 2 ink items, scaled down

    @backlog
    Scenario: Google Calendar only gets a placeholder title for an ink item
      Then the Google event for the task list "Groceries" has the description:
        """
        ☐ Handwritten item
        ☐ Handwritten item
        """

    @backlog
    Scenario: The ink is in the backup with the server files
      When the backup to Drive runs
      Then the backup holds the ink of the task list "Groceries"

  Rule: A shared list shares its ink with the other person

    @backlog
    Scenario: The other person sees the ink
      Given the Labs switch "Handwritten lists" is on
      And "jo@example.com" has an undated task list "Groceries" with the ink items "Milk, Eggs"
      And "jo@example.com" is signed in
      When I share the task list "Groceries" with "anna@example.com"
      And "anna@example.com" opens the Tasks view on another device
      Then the task list "Groceries" shows 2 ink items, scaled down

  Rule: Switching handwriting off keeps what I wrote (assumption A2)

    @backlog
    Scenario: Ink items stay visible, read-only, when the feature is off
      Given the Labs switch "Handwritten lists" is off
      And the calendar contains a task list "Groceries" on 2026-10-14 with the ink items "Milk, Eggs"
      When I open the Tasks view
      Then the task list "Groceries" shows 2 ink items, scaled down
      And the item writing area offers no writing mode switch
      And I can still tick the item number 1

  @mobile @backlog
  Scenario: The add button never covers the writing area
    Given the Labs switch "Handwritten lists" is on
    When I open the new task list form
    Then the add button covers no control of the "writing area"
