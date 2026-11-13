@ui-expressive @id:ui-expressive
Feature: One action vocabulary in Material 3 Expressive (design "E")
  Owner decision 2026-10-30: the whole app speaks one action vocabulary (ADR 0032, design E). Every surface has at most
  one filled primary action (the + button, Save, Today); everything else is tonal or text. Actions in headers and
  toolbars are icon-only and carry an accessible label (their name for screen readers and as a tooltip). A card keeps
  its secondary actions behind one overflow button (three dots, "More"). Open, Canvas and Archive are one connected
  button group. Raw hand-styled buttons outside `web/src/components/m3` are forbidden by a lint gate. Theme corners
  (Winter square, Neon pill) shape only events and cards; bars, pills and buttons stay round in every theme.
  The scenarios without a viewport tag run on the phone only (`@mobile`).

  Background:
    Given the calendar is empty
    And today is 2026-10-12

  Rule: One filled primary action per surface

    @mobile
    Scenario: The week view has exactly one filled primary action besides Today
      When I open the week view for 2026-10-12
      Then the surface has one filled "create button"
      And the surface has one filled "Today button"
      And every other button of the surface is tonal, outlined or text

    @mobile
    Scenario: The event dialog has Save as its only filled action
      Given the calendar contains an event "Dentist" on 2026-10-12 from 10:40 to 11:30
      When I open the week view for 2026-10-12
      And I open the event "Dentist"
      Then the dialog has one filled "Save button"
      And every other button of the dialog is tonal, outlined or text

    @mobile
    Scenario: The settings screen has no filled button
      When I open the week view for 2026-10-12
      And I open the settings
      Then no button of the settings screen is filled

  Rule: Icon-only actions carry an accessible label

    @mobile
    Scenario Outline: Header and toolbar icons are icon-only and named
      When I open the week view for 2026-10-12
      Then the "<control>" is an icon with the label "<label>"

      Examples:
        | control         | label    |
        | settings button | Settings |
        | filter button   | Filter   |
        | Today button    | Today    |

    @mobile
    Scenario: A screen reader finds every icon-only button by its name
      When I open the week view for 2026-10-12
      Then every icon-only button of the screen has an accessible label

  Rule: A card keeps its secondary actions behind one overflow button

    @mobile
    Scenario: A task list card offers its secondary actions in the overflow menu
      Given the calendar contains a task list "Groceries" on 2026-10-12 with items:
        | item | done |
        | Milk | no   |
      When I open the Tasks view
      And I open the overflow menu of the task list "Groceries"
      Then the overflow menu lists "Edit, Duplicate, Archive, Save as template, Delete"

    @mobile
    Scenario: The card shows one overflow button and no other action button
      Given the calendar contains a task list "Groceries" on 2026-10-12 with items:
        | item | done |
        | Milk | no   |
      When I open the Tasks view
      Then the task list "Groceries" shows one overflow button and no other action button

  Rule: Open, Canvas and Archive are one connected button group

    @mobile
    Scenario: The Tasks view groups Open, Canvas and Archive
      When I open the path "/tasks"
      Then the button group shows "Open, Canvas, Archive" as one connected group
      And exactly one of them is selected

    @mobile
    Scenario: Choosing Archive in the group opens the archive
      When I open the path "/tasks"
      And I press "Archive" in the button group
      Then the "Archive" button of the group is selected

  Rule: Raw buttons are not allowed outside the Material 3 components

    @unit
    # unit: web/test/lint-gate.test.ts:no raw buttons outside m3
    Scenario: The lint gate rejects a hand-styled button outside the m3 components
      Given a component outside "web/src/components/m3" contains a raw button element
      When the lint gate runs
      Then the lint gate fails and names that component
      And a button element inside "web/src/components/m3" passes the lint gate

  Rule: A pressed button squishes slightly and never turns square

    @unit
    # unit: web/test/touch-css.test.ts:a pressed control squishes slightly and never turns square: the radius change is animated and stays medium or rounder
    Scenario: Pressing a button squishes it a little and its corners stay clearly rounded
      Given the style rules of the Material 3 components
      When a control is pressed
      Then its corners change smoothly and only a little, and never look square

  Rule: Theme corners shape events and cards only

    @mobile
    Scenario Outline: Bars, pills and buttons stay round in every theme
      Given the calendar contains an event "Dentist" on 2026-10-12 from 10:40 to 11:30
      And the theme is "<theme>"
      When I open the week view for 2026-10-12
      Then the bottom bar, the top bar and every button are drawn with fully round corners

      Examples:
        | theme   |
        | Winter  |
        | Neon    |
        | Default |

    @mobile
    Scenario: Winter draws events and cards with square corners
      Given the calendar contains an event "Dentist" on 2026-10-12 from 10:40 to 11:30
      And the theme is "Winter"
      When I open the week view for 2026-10-12
      Then the event "Dentist" has a corner radius of 0 px

    @mobile
    Scenario: Neon draws events as pills while the bottom bar keeps its shape
      Given the calendar contains an event "Dentist" on 2026-10-12 from 10:40 to 11:30
      And the theme is "Neon"
      When I open the week view for 2026-10-12
      Then the event "Dentist" has a corner radius of 16 px
      And the bottom bar, the top bar and every button are drawn with fully round corners

  Rule: The kit controls have the Material 3 sizes and shapes

    @mobile
    Scenario: Every icon button can be tapped on at least 48 by 48 pixels
      When I open the week view for 2026-10-12
      Then every icon button of the screen has a tap area of at least 48 by 48 pixels

    @mobile
    Scenario: A text field shows a line along its bottom that thickens while it is focused
      When I start a new event
      And I click into the field "Title"
      Then the field "Title" shows a 2 pixel line along its bottom in the primary colour
      And the field "Description" shows a 1 pixel line along its bottom

    @unit
    # unit: web/test/m3-kit-sizes.test.ts:a button is 40 px high on a 48 px tap area and stays round at any height
    Scenario: A button is 40 pixels high, can be tapped on 48 pixels and stays round
      Given the style rules of the Material 3 components
      Then a button is drawn 40 pixels high on a tap area 48 pixels high
      And its corners stay fully round however tall its label makes it

    @unit
    # unit: web/test/m3-kit-sizes.test.ts:a chip is 32 px high with 8 px corners
    Scenario: A chip is 32 pixels high with 8 pixel corners
      Given the style rules of the Material 3 components
      Then a chip is drawn 32 pixels high with 8 pixel corners

    @unit
    # unit: web/test/m3-kit-sizes.test.ts:a text field is filled by default and outlined on request
    Scenario: A text field is filled by default and can be outlined
      Given the style rules of the Material 3 components
      Then a text field has rounded top corners only and a line along its bottom
      And an outlined text field has a 1 pixel outline that turns 2 pixels while it is focused
