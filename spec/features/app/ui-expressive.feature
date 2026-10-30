@ui-expressive @id:ui-expressive
Feature: One action vocabulary in Material 3 Expressive (design "E")
  Owner decision 2026-10-30: the whole app speaks one action vocabulary (ADR 0031, design E). Every surface has at most
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

    @mobile @backlog
    Scenario: The week view has exactly one filled primary action besides Today
      When I open the week view for 2026-10-12
      Then the surface has one filled "create button"
      And the surface has one filled "Today button"
      And every other button of the surface is tonal, outlined or text

    @mobile @backlog
    Scenario: The event dialog has Save as its only filled action
      Given the calendar contains an event "Dentist" on 2026-10-12 from 10:40 to 11:30
      When I open the week view for 2026-10-12
      And I open the event "Dentist"
      Then the dialog has one filled "Save button"
      And every other button of the dialog is tonal, outlined or text

    @mobile @backlog
    Scenario: The settings screen has no filled button
      When I open the settings
      Then no button of the settings screen is filled

  Rule: Icon-only actions carry an accessible label

    @mobile @backlog
    Scenario Outline: Header and toolbar icons are icon-only and named
      When I open the week view for 2026-10-12
      Then the "<control>" is an icon with the label "<label>"

      Examples:
        | control         | label    |
        | settings button | Settings |
        | filter button   | Filter   |
        | Today button    | Today    |

    @mobile @backlog
    Scenario: A screen reader finds every icon-only button by its name
      When I open the week view for 2026-10-12
      Then every icon-only button of the screen has an accessible label

  Rule: A card keeps its secondary actions behind one overflow button

    @mobile @backlog
    Scenario: A task list card offers its secondary actions in the overflow menu
      Given the calendar contains a task list "Groceries" on 2026-10-12 with items:
        | item | done |
        | Milk | no   |
      When I open the week view for 2026-10-12
      And I open the overflow menu of the task list "Groceries"
      Then the overflow menu lists "Edit, Duplicate, Archive, Delete"

    @mobile @backlog
    Scenario: The card shows one overflow button and no row of small buttons
      Given the calendar contains a task list "Groceries" on 2026-10-12 with items:
        | item | done |
        | Milk | no   |
      When I open the week view for 2026-10-12
      Then the task list "Groceries" shows one overflow button and no other action button

  Rule: Open, Canvas and Archive are one connected button group

    @mobile @backlog
    Scenario: The Tasks view groups Open, Canvas and Archive
      When I open the path "/tasks"
      Then the button group shows "Open, Canvas, Archive" as one connected group
      And exactly one of them is selected

    @mobile @backlog
    Scenario: Choosing Archive in the group opens the archive
      When I open the path "/tasks"
      And I press "Archive" in the button group
      Then the "Archive" button of the group is selected

  Rule: Raw buttons are not allowed outside the Material 3 components

    @unit @backlog
    # unit: e2e/STEPS.md:no raw buttons outside m3
    Scenario: The lint gate rejects a hand-styled button outside the m3 components
      Given a component outside "web/src/components/m3" contains a raw button element
      When the lint gate runs
      Then the lint gate fails and names that component
      And a button element inside "web/src/components/m3" passes the lint gate

  Rule: Theme corners shape events and cards only

    @mobile @backlog
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

    @mobile @backlog
    Scenario: Winter draws events and cards with square corners
      Given the calendar contains an event "Dentist" on 2026-10-12 from 10:40 to 11:30
      And the theme is "Winter"
      When I open the week view for 2026-10-12
      Then the event "Dentist" has a corner radius of 0 px

    @mobile @backlog
    Scenario: Neon draws events as pills while the bottom bar keeps its shape
      Given the calendar contains an event "Dentist" on 2026-10-12 from 10:40 to 11:30
      And the theme is "Neon"
      When I open the week view for 2026-10-12
      Then the event "Dentist" has a corner radius of 16 px
      And the bottom bar, the top bar and every button are drawn with fully round corners
