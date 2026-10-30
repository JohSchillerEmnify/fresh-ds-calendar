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
  Pen (Apple Pencil, Windows pen, Android stylus, with pressure) and mouse draw; by default a finger keeps scrolling and
  tapping (the Labs setting "Draw with finger" changes that); a resting palm never draws. Ink is stored on our server per
  person with a copy on the device (readable offline), is backed up with the server's files to Drive, and Google Calendar
  only gets a placeholder title for an ink item. A list shared with another person shares its ink like its items.
  Undo: a small undo button beside the writing mode switch takes back the last stroke while the dialog is open; the Apple
  Pencil double tap does the same where the device passes it on to the browser (best effort, not guaranteed).

  Decisions (owner, 2026-10-30)
  A1. "Per item": every ink item is one line of ink drawn on its own ruled line (not one page of ink per list).
  A2. Switching the feature off leaves existing ink items visible, read-only and still tickable; they are not deleted.
  A3. An ink item has no title, so Google shows the placeholder "Handwritten item" for it (wording to confirm).
  A4. The writing mode is remembered per device, not per list.
  A5. Items written in TEXT mode are ordinary items; nothing marks them as written by hand.
  A6. "Large device" = a viewport as wide as an iPad (768 px or more) or a desktop that reports pen support.
  Q1. Undo: an undo button next to the mode switch undoes the last stroke while the dialog is open; Apple Pencil double
      tap = undo as well, best effort where the device passes it to the browser.
  Q2. Eraser: the pen's eraser end (e.g. Surface pen, pointer eraser button) erases the strokes it touches; an eraser
      button toggles erase mode (for the Apple Pencil, which has no eraser end).
  Q3. Limit: about 200 KB of ink per list; when reached the app says the list is full and suggests a new list; no more
      strokes are taken.
  Q4. Colour: default is the theme's text colour; a few fixed presets plus "custom" (colour picker) can be chosen; every
      colour is adjusted so it stays readable in light and dark. The line width follows the pen pressure.
  Q5. One list can mix ink and text items; the writing mode decides how the NEXT item is written.
  Q6. The pen on an existing ink item keeps writing on that line (adds strokes); it does not replace the line.
  Q7. Lists from templates and repeating lists copy their ink items.
  Q8. A Labs setting "Draw with finger", off by default. When on, a finger draws in the writing area and scrolling there
      takes two fingers. A resting palm never draws in either case.
  Q9. A phone where a stylus is used or reported gets the same ruled writing dialog as the tablet (one component), sized
      to fit the phone window. A phone without a pen keeps the unchanged dialog.

  ASSUMPTIONS (not yet confirmed by the owner)
  A7. The chosen ink colour is remembered per device, like the writing mode (A4).

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

  Rule: Pen and mouse draw, a finger and a resting palm do not (a finger draws only with the setting "Draw with finger")

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
    Scenario: A finger scrolls the list instead of drawing when "Draw with finger" is off
      Given the Labs setting "Draw with finger" is off
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

  Rule: The list dialog is larger and ruled where a pen is used, sized to the window; a phone without a pen keeps it as it is

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
    Scenario: On a phone without a pen the dialog is unchanged and the switch is still there
      Given the device reports no pen support
      When I open the new task list form
      Then the dialog is as large as without the feature
      And the new list form shows the writing mode switch with the pen icon

    @mobile @backlog
    Scenario: On a phone where a pen is used the same ruled dialog fits the window
      Given the device reports pen support
      When I open the new task list form
      Then the dialog shows ruled lines to write on
      And the dialog fits the window

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

  Rule: A finger draws only when the Labs setting "Draw with finger" is on (decision Q8)

    Background:
      Given the Labs switch "Handwritten lists" is on

    @backlog
    Scenario: "Draw with finger" is off until switched on
      When I open the settings
      Then the Labs setting "Draw with finger" is off

    @mobile @backlog
    Scenario: With the setting on a finger draws on the writing area
      Given the Labs setting "Draw with finger" is on
      And the expanded task list "Notes" has more ink items than fit the screen
      When I draw a stroke with a finger
      Then the stroke is drawn on the line

    @mobile @backlog
    Scenario: With the setting on two fingers scroll the writing area
      Given the Labs setting "Draw with finger" is on
      And the expanded task list "Notes" has more ink items than fit the screen
      When I swipe up on the writing area with two fingers
      Then the list scrolls
      And nothing is drawn

    @mobile @backlog
    Scenario: With the setting on a resting palm still does not draw
      Given the Labs setting "Draw with finger" is on
      And the expanded task list "Notes" has more ink items than fit the screen
      When I rest my palm on the writing area and draw a stroke with the pen
      Then only the pen stroke is drawn

  Rule: Undo takes back the last stroke while the dialog is open (decision Q1)

    Background:
      Given the Labs switch "Handwritten lists" is on
      And I open the new task list form

    @backlog
    Scenario: The undo button removes the last stroke
      When I draw 2 strokes with the pen
      And I press the undo button
      Then the writing area shows 1 stroke

    @backlog
    Scenario: The Apple Pencil double tap undoes the last stroke where the device passes it on
      Given the device passes the pen double tap on
      When I draw 2 strokes with the pen
      And I double tap the pen
      Then the writing area shows 1 stroke

  Rule: The eraser removes strokes (decision Q2)

    Background:
      Given the Labs switch "Handwritten lists" is on
      And I open the new task list form

    @backlog
    Scenario: The eraser end of the pen erases the strokes it touches
      Given I have drawn 2 strokes with the pen
      When I touch the first stroke with the eraser end of the pen
      Then the writing area shows 1 stroke

    @backlog
    Scenario: The eraser button switches to erase mode for a pen without an eraser end
      Given I have drawn 2 strokes with the pen
      When I press the eraser button
      And I touch the first stroke with the pen
      Then the writing area shows 1 stroke
      When I press the eraser button
      And I draw a stroke with the pen
      Then the writing area shows 2 strokes

  Rule: A list holds about 200 KB of ink (decision Q3)

    @backlog
    Scenario: A full list says so and takes no more strokes
      Given the Labs switch "Handwritten lists" is on
      And the task list "Notes" holds about 200 KB of ink
      When I draw a stroke with the pen
      Then the app says the list is full and suggests starting a new list
      And nothing is drawn

  Rule: Ink colour and width (decision Q4, assumption A7)

    Background:
      Given the Labs switch "Handwritten lists" is on
      And I open the new task list form

    @backlog
    Scenario: The default ink colour is the theme's text colour
      When I draw a stroke with the pen
      Then the stroke has the theme's text colour

    @backlog
    Scenario: A preset colour can be chosen
      When I choose the ink colour preset "red"
      And I draw a stroke with the pen
      Then the stroke is red

    @backlog
    Scenario: A custom colour can be chosen with the colour picker
      When I choose the custom ink colour "#12AB56" in the colour picker
      And I draw a stroke with the pen
      Then the stroke has the colour "#12AB56"

    @backlog
    Scenario: A chosen colour stays readable in light and dark
      Given I choose the custom ink colour "#000000"
      When the theme is dark
      Then the stroke is adjusted so it is readable on the dark background

    @backlog
    Scenario: The chosen colour is remembered on the device
      Given I choose the ink colour preset "red"
      When I open the app again
      And I open the new task list form
      Then the chosen ink colour is "red"

  Rule: One list can mix ink and text items (decision Q5)

    @backlog
    Scenario: The writing mode decides how the next item is written
      Given the Labs switch "Handwritten lists" is on
      And the calendar contains a task list "Mixed" on 2026-10-14 with the ink items "Milk"
      And I expand the task list "Mixed"
      When I press the writing mode switch
      And I add the text item "Eggs"
      Then the expanded task list has 2 items
      And the item number 1 is an ink item
      And the item number 2 is a text item

  Rule: The pen on an ink item keeps writing on that line (decision Q6)

    @backlog
    Scenario: A pen stroke on an existing ink item adds to it
      Given the Labs switch "Handwritten lists" is on
      And the calendar contains a task list "Groceries" on 2026-10-14 with the ink items "Milk, Eggs"
      And I expand the task list "Groceries"
      When I draw a stroke with the pen on the ink item number 1
      Then the expanded task list has 2 items
      And the ink item number 1 has one more stroke

  Rule: Templates and repeating lists copy ink items (decision Q7)

    Background:
      Given the Labs switch "Handwritten lists" is on

    @backlog
    Scenario: A list made from a template has the template's ink items
      Given the template "Weekly shop" has the ink items "Milk, Eggs"
      When I create a task list from the template "Weekly shop"
      Then the new task list shows 2 ink items, scaled down

    @backlog
    Scenario: The next occurrence of a repeating list has the ink items
      Given the calendar contains a repeating task list "Groceries" with the ink items "Milk, Eggs"
      When the next occurrence of the task list "Groceries" is created
      Then the next occurrence shows 2 ink items, scaled down

  @mobile @backlog
  Scenario: The add button never covers the writing area
    Given the Labs switch "Handwritten lists" is on
    When I open the new task list form
    Then the add button covers no control of the "writing area"
