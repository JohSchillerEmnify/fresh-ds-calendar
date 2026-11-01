@tasklists @labs @handwriting @id:handwritten-lists
Feature: Labs: handwritten lists
  Experimental (Labs, off by default, its own switch in Settings > Labs). I can write the items of a task list by hand
  with a pen. The mouse never draws (R1). A small switch beside the writing area changes between two ways of writing:
  INK keeps my handwriting as it is, as a picture; TEXT shows ruled ordinary text fields, where the device's own
  handwriting recognition (iPad Scribble, Windows 11 pen input) turns the writing into text on the device. The app has
  no recognition of its own and no button that turns ink into text.
  A list keeps its structure: in ink mode every item is a line of ink in place of a title, and ticking, reordering,
  removing and the done count work as for any item. Writing happens in the open list (sheet or expanded card), in the new
  list form and on Canvas notes; everywhere else (calendar cards, the tray, the Tasks view) ink items are shown
  read-only and scaled down.
  Only a pen draws (Apple Pencil, Windows pen, Android stylus, with pressure); the mouse never does: it clicks, selects
  and drags. By default a finger keeps scrolling and tapping (the Labs setting "Draw with finger" changes that); a
  resting palm never draws. Typing always works, also in ink mode (R2). Ink is stored on our server per
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
  R1. (owner, after the mockup, 2026-10-30; "how is drag&drop gonna work on pc when mouse draws? ... not sure if it makes
      sense to have mouse writing. Only pen should write on desktop.") The MOUSE NEVER DRAWS. Only a pen draws, plus a
      finger only with the Labs setting "Draw with finger" (Q8). The mouse clicks, selects and drags; a mouse drag over
      the writing area draws nothing.
  R2. (owner, same date; "I want it to be possible as well to write with keyboard") Typing always works, also in ink
      mode: clicking or tapping the next empty line and typing creates a text item in the same list (mixing is allowed,
      Q5).
  R3. (owner, same date) Reordering: each line has a grip handle at its edge; mouse, finger or pen on the handle moves
      the item; the pen anywhere else on the line writes. Today's long press keeps working for mouse and finger exactly
      as now (tasklists-items.feature), so the pen's writing never competes with moving.
  R4. (owner, same date) The larger ruled dialog stays for iPad-sized screens and desktops that report pen support
      (A6, unchanged). On a desktop without a pen nothing changes: the dialog keeps its size, and typing and the mouse
      work as before.
  A6. "Large device" = a viewport as wide as an iPad (768 px or more) or a desktop that reports pen support.
  M3. Cards with ink (owner, 2026-10-30): the text lines of such a card grow to the ink line height (about 24 px), so
      text and ink sit evenly. R1–R4 scenarios approved by the owner, incl. a mouse click on an ink item ticks it.
  M2. In ink mode on a tablet or desktop the opened list (popover) is wider, so a line is long enough to write on
      (owner, mockup); text, row height, tap targets and controls stay as today. The phone sheet stays as it is.
  T1. Android tablets count like iPads (owner, 2026-10-30): an Android tablet with a stylus (e.g. S Pen), in the Android
      app or the browser, gets the same larger ruled dialog and the same rules; the stylus draws with pressure, its side
      button or eraser end erases where the device reports it (best effort, like the Apple Pencil double tap).
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
  G1. Offline: the feature is built AFTER the device-first outbox (ADR 0025, branch docs/adr-device-first). Ink is
      writable offline and synced later like everything else.
  G2. Places that cannot show the app UI show the placeholder text "Handwritten item" for an ink item: Google Calendar
      and the Android home-screen widget. (owner 2026-10-30: no ink picture in the widget; notifications never show item
      text (reminders), and the door board is dropped as the door is deactivated.)
  G3. Screen readers read an ink item as "Handwritten item 2 of 5" plus its ticked state. Ink is not searchable:
      (owner 2026-10-30: no new search field in Tasks) the existing Archive search finds a finished list by its title only.
  G4. The list title always stays text (keyboard or the device's own handwriting recognition).
  G5. Conflicts: two devices change the same list -> merged per item: new strokes and items from both devices are
      kept; only when the same line was erased on one device and extended on the other does the later change win.
  G6. A ticked ink item is struck through with the same strike line as text items and faded to about half.
  G7. Left-handed mode mirrors the tool row and the rows (owner, 2026-10-30): checkbox on the right, grip handle on the left, the
      writing starts after a free strip on the left so the palm rests on the screen (not over its edge, which breaks palm
      rejection); writing still runs left to right. Save/Cancel mirror as in every dialog today. To verify with a
      left-handed tester.
  G8. Ink is stored relative to the line height and scaled to the line on every screen, so the same ink looks the same
      on phone, tablet and desktop (smaller on a smaller line, never cut off).
  A10. (owner OK, 2026-10-30) In TEXT mode the item fields are ruled on every device (the person chose that mode); the
       dialog's size and the ink lines still depend on pen support (R4).
  M1. Calendar cards (owner, mockup review): an ink item shows on a card only where the card shows item lines today
      (the card is long enough); a card's behaviour does not change: same height, collapse levels, done count and
      grown card as with text items, an ink line simply takes the place of a title line.

  ASSUMPTIONS (not yet confirmed by the owner)
  A7. The chosen ink colour is remembered per device, like the writing mode (A4).
  A8. Deleting an ink item or a whole list removes its ink from the server (not kept as an orphan).
  A9. For G5, "erased" means the strokes of the line are removed (the item stays); a seeded ink item holds one stroke.

  Background:
    Given the calendar is empty
    And today is 2026-10-12

  Scenario: Handwriting is off until switched on in the Labs
    When I open the settings
    Then the Labs switch "Handwritten lists" is off
    When I open the new task list form
    Then the new list form has no writing mode switch

  Scenario: Switching handwriting on shows the writing mode switch
    Given the Labs switch "Handwritten lists" is on
    When I open the new task list form
    Then the new list form shows the writing mode switch with the pen icon

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

    Scenario: A pen stroke on a ruled line becomes an ink item
      When I write an ink item with the pen
      Then the expanded task list has 4 items
      And the task list "Groceries" shows the done count "0/4"

    Scenario: An ink item is ticked off like any item
      When I tick the item number 2
      Then the item number 2 is ticked
      And the task list "Groceries" shows the done count "1/3"

    Scenario: An ink item is reordered by dragging its handle
      When I drag the item number 3 above the item number 1
      Then the ink items are in the order "Bread, Milk, Eggs"

    Scenario: An ink item is removed
      When I delete the item number 2
      Then the task list "Groceries" shows the done count "0/2"

  Rule: Only a pen draws, the mouse never does, a finger and a resting palm do not (a finger draws only with the setting "Draw with finger"; decision R1)

    Background:
      Given the Labs switch "Handwritten lists" is on
      And the expanded task list "Notes" has more ink items than fit the screen

    Scenario: A pen draws with the pressure of the stroke
      When I draw a stroke with the pen
      Then the stroke is drawn on the line, thicker where I pressed harder

@desktop
    Scenario: The mouse never draws, it clicks, selects and drags
      When I drag with the mouse over the writing area
      Then nothing is drawn
      When I click the ink item number 1 with the mouse
      Then the item number 1 is ticked

@mobile
    Scenario: A finger scrolls the list instead of drawing when "Draw with finger" is off
      Given the Labs setting "Draw with finger" is off
      When I swipe up on the writing area with a finger
      Then the list scrolls
      And nothing is drawn

    # unit: web/test/ink-lib.test.ts:a normal stroke is thin and pressing hard makes it clearly thicker
    @unit
    Scenario: A normal stroke is thin and pressing harder makes it clearly thicker
      When I draw a stroke with the pen at the pressure 0.1
      And I draw a stroke with the pen at the pressure 0.5
      And I draw a stroke with the pen at the pressure 1.0
      Then the stroke at pressure 1.0 is at most half as thick as before: at most 0.075 of a line height
      And the stroke at pressure 0.5 is at most 0.05 of a line height
      And the stroke at pressure 1.0 is at least 2.5 times as thick as the stroke at pressure 0.1

    Scenario: A downward pen stroke draws and does not scroll the list
      When I draw a stroke 40 pixels downwards with the pen on the ink item number 3
      Then the ink item number 3 has one more stroke
      And the list has not scrolled

    Scenario: While the pen is over the writing area the list does not scroll; a finger still scrolls
      When I hold the pen over the ink item number 3
      Then the writing area does not let the browser pan
      When I move the pen away from the writing area
      Then the writing area lets a finger pan the list up and down

    Scenario: A finger touching the writing area after the pen was over it can scroll again
      When I hold the pen over the ink item number 3
      And I touch the ink item number 3 with a finger
      Then the writing area lets a finger pan the list up and down

    Scenario: A resting palm does not draw while the pen writes
      When I rest my palm on the writing area and draw a stroke with the pen
      Then only the pen stroke is drawn

    Scenario: A tap with a finger on an ink item still ticks it
      When I tap the ink item number 1 with a finger
      Then the item number 1 is ticked and nothing is drawn

  Rule: The list dialog is larger and ruled where a pen is used, sized to the window; a phone without a pen keeps it as it is

    Background:
      Given the Labs switch "Handwritten lists" is on

    @tablet
    Scenario: On a tablet the list dialog is larger and shows ruled lines
      When I open the new task list form on a screen 1024 pixels wide
      Then the dialog is larger than without the feature
      And the dialog shows ruled lines to write on

@tablet
    Scenario: An Android tablet with a stylus gets the larger ruled dialog (decision T1)
      Given the device is an Android tablet that reports pen support
      When I open the new task list form
      Then the dialog shows ruled lines to write on
      And the dialog is larger than without the feature

@desktop
    Scenario: A desktop that reports pen support gets the larger ruled dialog
      Given the device reports pen support
      When I open the new task list form
      Then the dialog shows ruled lines to write on

    @desktop
    Scenario: A desktop without pen support keeps the dialog as it is (decision R4)
      Given the device reports no pen support
      When I open the new task list form
      Then the dialog is as large as without the feature
      And the dialog shows no ruled lines to write on
      And typing in the item field works as without the feature
      And the new list form shows the writing mode switch with the pen icon

    @mobile
    Scenario: On a phone without a pen the dialog is unchanged and the switch is still there
      Given the device reports no pen support
      When I open the new task list form
      Then the dialog is as large as without the feature
      And the new list form shows the writing mode switch with the pen icon

    @mobile
    Scenario: On a phone where a pen is used the same ruled dialog fits the window
      Given the device reports pen support
      When I open the new task list form
      Then the dialog shows ruled lines to write on
      And the dialog fits the window

  Rule: In text mode the fields are ordinary text fields the device can recognise writing in

    Background:
      Given the Labs switch "Handwritten lists" is on

    Scenario: Text mode shows ruled plain text fields
      Given the writing mode is "text"
      When I open the new task list form
      Then the item fields are ruled, ordinary text fields
      And the form has no button that turns ink into text

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

    Scenario: A calendar card shows the ink items scaled down
      When I open the day view for 2026-10-14
      Then the card of "Groceries" shows 2 ink items, scaled down
      And a pen stroke on the card draws nothing

    # Owner 2026-10-31: the ink on a card was too small to read.
    Scenario Outline: Ink on a card fills the card's text line
      Given the calendar contains a task list "" on 2026-10-14 with the ink items "Milk"
      When I open the <view> view for <period>
      Then the ink of the card of the untitled task list is as tall as the card's text

      Examples:
        | view  | period     |
        | day   | 2026-10-14 |
        | week  | 2026-10-12 |
        | month | 2026-10    |

    # Owner 2026-10-31: ink was barely visible on coloured cards, its checkbox sat off, and a list with one ink item showed an empty title.
    Scenario Outline: Ink on a coloured card is as readable as the card's text
      Given the calendar contains a task list "Yellowpad" on 2026-10-14 with the ink items "Milk" in the colour "<ink>"
      When I open the <view> view for <period>
      Then the ink of the card of "Yellowpad" reads on the card

      Examples:
        | ink     | view  | period     |
        | #ffee00 | day   | 2026-10-14 |
        | #000000 | week  | 2026-10-12 |
        | #ffffff | month | 2026-10    |

    Scenario Outline: An ink item's checkbox and ink line up like a text item
      Given the calendar contains a task list "Mixed" on 2026-10-14 at 09:00 for 120 minutes with the text item "Eggs" and the ink item "Milk"
      When I open the <view> view for <period>
      Then the checkbox of every item of the card of "Mixed" is centred on its row

      Examples:
        | view  | period     |
        | day   | 2026-10-14 |
        | week  | 2026-10-12 |

    Scenario Outline: A list whose only item is handwritten shows the ink as its title
      Given the calendar contains a task list "" on 2026-10-14 with the ink items "Milk"
      When I open the <view> view for <period>
      Then the card of the untitled task list shows the ink as its title
      And the task list "" shows no done count
      And the task list "" shows no progress ring

      Examples:
        | view  | period     |
        | day   | 2026-10-14 |
        | week  | 2026-10-12 |
        | month | 2026-10    |

    Scenario: The Tasks view shows the ink items read-only
      When I open the Tasks view
      Then the task list "Groceries" shows 2 ink items, scaled down

    Scenario: A Canvas note can be written on
      When I open the Canvas
      And I write an ink item on the note "Groceries" with the pen
      Then the note "Groceries" shows 3 ink items

  Rule: Ink lives on the server per person and on the device

    Background:
      Given the Labs switch "Handwritten lists" is on
      And the calendar contains a task list "Groceries" on 2026-10-14 with the ink items "Milk, Eggs"

    Scenario: Ink is shown without a connection
      Given I have seen the day view for 2026-10-14
      When the network connection is lost
      And I open the app again
      Then the card of "Groceries" shows 2 ink items, scaled down

    Scenario: Ink follows me to another device
      When I switch to another device
      And I open the day view for 2026-10-14
      Then the card of "Groceries" shows 2 ink items, scaled down

    Scenario: Google Calendar only gets a placeholder title for an ink item
      Then the Google event for the task list "Groceries" has the description:
        """
        ☐ Handwritten item
        ☐ Handwritten item
        """

    Scenario: The ink is in the backup with the server files
      When the backup to Drive runs
      Then the backup holds the ink of the task list "Groceries"

  Rule: A shared list shares its ink with the other person

    Scenario: The other person sees the ink
      Given the Labs switch "Handwritten lists" is on
      And "jo@example.com" has an undated task list "Groceries" with the ink items "Milk, Eggs"
      And "jo@example.com" is signed in
      When I share the task list "Groceries" with "anna@example.com"
      And "anna@example.com" opens the Tasks view on another device
      Then the task list "Groceries" shows 2 ink items, scaled down

  Rule: Switching handwriting off keeps what I wrote (assumption A2)

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

    Scenario: "Draw with finger" is off until switched on
      When I open the settings
      Then the Labs setting "Draw with finger" is off

@mobile
    Scenario: With the setting on a finger draws on the writing area
      Given the Labs setting "Draw with finger" is on
      And the expanded task list "Notes" has more ink items than fit the screen
      When I draw a stroke with a finger
      Then the stroke is drawn on the line

@mobile
    Scenario: Switched on in the settings, a real finger drag draws on the writing area
      Given I open the settings
      When I switch the Labs setting "Draw with finger" on
      And the expanded task list "Notes" has more ink items than fit the screen
      And I drag one finger along the writing area
      Then the stroke is drawn on the line

@mobile
    Scenario: Switched on in the settings, a real finger drag draws in the new task list form
      Given I open the settings
      When I switch the Labs setting "Draw with finger" on
      And I open the new task list form
      And I drag one finger along the writing area
      Then the writing area shows 1 stroke

@mobile
    Scenario: A broad finger tip still draws
      Given I open the settings
      When I switch the Labs setting "Draw with finger" on
      And the expanded task list "Notes" has more ink items than fit the screen
      And I drag one broad finger along the writing area
      Then the stroke is drawn on the line

@mobile
    Scenario: A finger that rests a moment before writing draws and does not pick the item up
      Given I open the settings
      When I switch the Labs setting "Draw with finger" on
      And the expanded task list "Notes" has more ink items than fit the screen
      And I drag one finger along the writing area after resting it for 600 ms
      Then the stroke is drawn on the line

@mobile
    Scenario: A finger draws on an existing ink item
      Given I open the settings
      When I switch the Labs setting "Draw with finger" on
      And the expanded task list "Notes" has more ink items than fit the screen
      And I drag one finger along the ink item number 2
      Then the ink item number 2 has one more stroke

@mobile
    Scenario: A finger that rests a moment on an existing ink item draws and does not pick the item up
      Given I open the settings
      When I switch the Labs setting "Draw with finger" on
      And the expanded task list "Notes" has more ink items than fit the screen
      And I drag one finger along the ink item number 2 after resting it for 600 ms
      Then the ink item number 2 has one more stroke

@mobile
    Scenario: With the setting on two fingers scroll the writing area
      Given the Labs setting "Draw with finger" is on
      And the expanded task list "Notes" has more ink items than fit the screen
      When I swipe up on the writing area with two fingers
      Then the list scrolls
      And nothing is drawn

@mobile
    Scenario: With the setting on a resting palm still does not draw
      Given the Labs setting "Draw with finger" is on
      And the expanded task list "Notes" has more ink items than fit the screen
      When I rest my palm on the writing area and draw a stroke with the pen
      Then only the pen stroke is drawn

  Rule: Undo takes back the last stroke while the dialog is open (decision Q1)

    Background:
      Given the Labs switch "Handwritten lists" is on
      And the device reports pen support
      And I open the new task list form

    Scenario: The undo button removes the last stroke
      When I draw 2 strokes with the pen
      And I press the undo button
      Then the writing area shows 1 stroke

    Scenario: The Apple Pencil double tap undoes the last stroke where the device passes it on
      Given the device passes the pen double tap on
      When I draw 2 strokes with the pen
      And I double tap the pen
      Then the writing area shows 1 stroke

  Rule: The eraser removes strokes (decision Q2)

    Background:
      Given the Labs switch "Handwritten lists" is on
      And the device reports pen support
      And I open the new task list form

    Scenario: The eraser end of the pen erases the strokes it touches
      Given I have drawn 2 strokes with the pen
      When I touch the first stroke with the eraser end of the pen
      Then the writing area shows 1 stroke

    Scenario: The eraser button switches to erase mode for a pen without an eraser end
      Given I have drawn 2 strokes with the pen
      When I press the eraser button
      And I touch the first stroke with the pen
      Then the writing area shows 1 stroke
      When I press the eraser button
      And I draw a stroke with the pen
      Then the writing area shows 2 strokes

  Rule: A list holds about 200 KB of ink (decision Q3)

    Scenario: A full list says so and takes no more strokes
      Given the Labs switch "Handwritten lists" is on
      And the task list "Notes" holds about 200 KB of ink
      And I expand the task list "Notes"
      When I draw a stroke with the pen
      Then the app says the list is full and suggests starting a new list
      And nothing is drawn

  Rule: Ink colour and width (decision Q4, assumption A7)

    Background:
      Given the Labs switch "Handwritten lists" is on
      And the device reports pen support
      And I open the new task list form

    Scenario: The default ink colour is the theme's text colour
      When I draw a stroke with the pen
      Then the stroke has the theme's text colour

    Scenario: A preset colour can be chosen
      When I choose the ink colour preset "red"
      And I draw a stroke with the pen
      Then the stroke is red

    Scenario: A custom colour can be chosen with the colour picker
      When I choose the custom ink colour "#12AB56" in the colour picker
      And I draw a stroke with the pen
      Then the stroke has the colour "#12AB56"

    Scenario: A chosen colour stays readable in light and dark
      Given I choose the custom ink colour "#000000"
      When the theme is dark
      Then the stroke is adjusted so it is readable on the dark background

    Scenario: The chosen colour is remembered on the device
      Given I choose the ink colour preset "red"
      When I open the app again
      And I open the new task list form
      Then the chosen ink colour is "red"

  Rule: One list can mix ink and text items (decision Q5)

    Scenario: The writing mode decides how the next item is written
      Given the Labs switch "Handwritten lists" is on
      And the calendar contains a task list "Mixed" on 2026-10-14 with the ink items "Milk"
      And I expand the task list "Mixed"
      When I press the writing mode switch
      And I add the text item "Eggs"
      Then the expanded task list has 2 items
      And the item number 1 is an ink item
      And the item number 2 is a text item

  Rule: Typing always works, also in ink mode (decision R2)

    Scenario: Clicking the next empty line and typing creates a text item in the same list
      Given the Labs switch "Handwritten lists" is on
      And the calendar contains a task list "Groceries" on 2026-10-14 with the ink items "Milk, Eggs"
      And I expand the task list "Groceries"
      And the writing mode is "ink"
      When I click the next empty line and type "Bread"
      Then the expanded task list has 3 items
      And the item number 1 is an ink item
      And the item number 3 is a text item

  Rule: Each line has a grip handle; the pen on the handle moves the item, the pen elsewhere writes (decision R3)

    Background:
      Given the Labs switch "Handwritten lists" is on
      And the calendar contains a task list "Groceries" on 2026-10-14 with the ink items "Milk, Eggs, Bread"
      And I expand the task list "Groceries"

    Scenario: The pen on the handle moves an ink item
      When I drag the grip handle of the item number 3 above the item number 1 with the pen
      Then the ink items are in the order "Bread, Milk, Eggs"
      And nothing is drawn

    Scenario: The pen elsewhere on the line writes
      When I draw a stroke with the pen on the ink item number 2
      Then the ink item number 2 has one more stroke
      And the ink items are in the order "Milk, Eggs, Bread"

@desktop
    Scenario: A long press with the mouse still moves an item
      When I long-press the item number 3 with the mouse and drag it above the item number 1
      Then the ink items are in the order "Bread, Milk, Eggs"

@mobile
    Scenario: A long press with a finger still moves an item
      When I long-press the item number 3 with a finger and drag it above the item number 1
      Then the ink items are in the order "Bread, Milk, Eggs"

  Rule: The pen on an ink item keeps writing on that line (decision Q6)

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

    Scenario: A list made from a template has the template's ink items
      Given the template "Weekly shop" has the ink items "Milk, Eggs"
      When I create a task list from the template "Weekly shop"
      Then the new task list shows 2 ink items, scaled down

    Scenario: The next occurrence of a repeating list has the ink items
      Given the calendar contains a repeating task list "Groceries" with the ink items "Milk, Eggs"
      When the next occurrence of the task list "Groceries" is created
      Then the next occurrence shows 2 ink items, scaled down

  Rule: Ink is writable offline and synced later (decision G1, ADR 0025)

    Background:
      Given the Labs switch "Handwritten lists" is on
      And the calendar contains a task list "Groceries" on 2026-10-14 with the ink items "Milk, Eggs"
      And I expand the task list "Groceries"

    Scenario: Ink written offline is visible at once and reaches another device after reconnecting
      Given the network connection is lost
      When I write an ink item with the pen
      Then the expanded task list has 3 items
      When the network connection is restored
      And I switch to another device
      And I open the Tasks view
      Then the task list "Groceries" shows 3 ink items, scaled down

  Rule: Where the app UI cannot be shown, an ink item is the text "Handwritten item" (decision G2)

    Background:
      Given the Labs switch "Handwritten lists" is on
      And the calendar contains a task list "Groceries" on 2026-10-14 with the ink items "Milk, Eggs"

    # unit: android/app/src/test/java/lan/mordor/calendar/widget/WeekDataTest.java:inkItemIsListedAsHandwrittenItem
    @unit
    Scenario: The Android home-screen widget names an ink item "Handwritten item"
      When the home-screen widget lists the task list "Groceries"
      Then the widget shows "Handwritten item" 2 times for the task list "Groceries"

  Rule: Screen readers read ink items by position, and search finds the list by its title only (decision G3)

    Background:
      Given the Labs switch "Handwritten lists" is on
      And the calendar contains a task list "Groceries" on 2026-10-14 with the ink items "Milk, Eggs, Bread, Rice, Tea"
      And I expand the task list "Groceries"

    Scenario: A screen reader reads an ink item with its position
      Then a screen reader reads the item number 2 as "Handwritten item 2 of 5"

    Scenario: A screen reader adds the ticked state
      When I tick the item number 2
      Then a screen reader reads the item number 2 as "Handwritten item 2 of 5, ticked"

  Rule: The Archive search finds a finished list by its title only, not by its ink (decision G3)

    Background:
      Given the Labs switch "Handwritten lists" is on
      And the calendar contains a task list "Groceries" finished on 2026-10-10 with the ink items "Milk, Eggs"

    Scenario: The Archive search finds the list by its title
      When I search the Archive for "Groceries"
      Then the Archive lists "Groceries"

    Scenario: The Archive search does not look into the ink or its placeholder
      When I search the Archive for "Handwritten"
      Then the Archive does not list "Groceries"

  Rule: The list title always stays text (decision G4)

    Scenario: In ink mode the title is still an ordinary text field
      Given the Labs switch "Handwritten lists" is on
      And the writing mode is "ink"
      When I open the new task list form
      Then the title field is an ordinary text field
      And the title field is not a writing area

  Rule: Two devices that change the same list are merged per item (decision G5, assumption A9)

    Background:
      Given the Labs switch "Handwritten lists" is on
      And the calendar contains a task list "Groceries" on 2026-10-14 with the ink items "Milk, Eggs"
      And two devices have the task list "Groceries" open

    Scenario: New items and new strokes from both devices are kept
      When the first device writes an ink item while offline
      And the second device draws a stroke on the ink item number 1 while offline
      And both devices reconnect
      Then both devices show 3 items in the task list "Groceries"
      And both devices show the ink item number 1 with 2 strokes

    Scenario: A line erased on one device and extended later on the other keeps the later change
      When the first device erases the ink item number 1 while offline
      And the second device draws a stroke on the ink item number 1 while offline
      And both devices reconnect
      Then both devices show the ink item number 1 with 1 stroke

    Scenario: A line extended on one device and erased later on the other keeps the later change
      When the second device draws a stroke on the ink item number 1 while offline
      And the first device erases the ink item number 1 while offline
      And both devices reconnect
      Then both devices show the ink item number 1 with 0 strokes

  Rule: A ticked ink item is struck through and faded like a text item (decision G6)

    Scenario: A ticked ink item has the strike line of a text item and is faded to about half
      Given the Labs switch "Handwritten lists" is on
      And the calendar contains a task list "Mixed" on 2026-10-14 with the ink items "Milk"
      And I expand the task list "Mixed"
      And I add the text item "Eggs"
      When I tick the item number 1
      And I tick the item number 2
      Then the ink item number 1 has the same strike line as the text item number 2
      And the ink item number 1 is faded to about half

  Rule: Left-handed mode mirrors the writing tools (decision G7)

    @mobile
    Scenario: The mode switch, undo, eraser and colour buttons swap sides
      Given the Labs switch "Handwritten lists" is on
      And the device reports pen support
      And I open the new task list form
      And I note where the writing tools are
      When I turn on left-handed mode
      And I open the new task list form
      Then every writing tool is at the mirror image of where it was, within 1 pixel

  Rule: Ink is scaled to the line on every screen (decision G8)

    Scenario Outline: The same ink looks the same on every screen size
      Given the Labs switch "Handwritten lists" is on
      And the calendar contains a task list "Groceries" on 2026-10-14 with the ink items "Milk, Eggs"
      When I expand the task list "Groceries" on a screen <width> pixels wide
      Then the ink of the item number 1 has the same proportions to its line as on a 1280 pixel wide screen
      And the ink of the item number 1 is not cut off

      Examples:
        | width |
        | 390   |
        | 820   |
        | 1280  |

  Rule: Deleting ink deletes it from the server (assumption A8)

    Background:
      Given the Labs switch "Handwritten lists" is on
      And the calendar contains a task list "Groceries" on 2026-10-14 with the ink items "Milk, Eggs"
      And I expand the task list "Groceries"

    Scenario: Deleting an ink item removes its ink
      When I delete the item number 2
      Then the server holds 1 ink item for the task list "Groceries"

    Scenario: Deleting the list removes all its ink
      When I delete the task list "Groceries"
      Then the server holds no ink for the task list "Groceries"

  @mobile
  Scenario: The add button never covers the writing area
    Given the Labs switch "Handwritten lists" is on
    And the device reports pen support
    When I open the new task list form
    Then the add button covers no control of the "writing area"
