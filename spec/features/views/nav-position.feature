@nav-position @id:nav-position
Feature: Where the view switcher sits
  The view switcher (Year, Month, Week, Day, Tasks, Clock, plus the Labs views when Labs is on) sits in a place the person
  chooses in the settings: at the bottom (a bottom navigation bar), at the top (a tabs row under the top app bar) or
  at the side (a slim navigation rail). There is one choice for phones and one for desktop and tablets, kept per
  person. Nothing else offers the choice: there is no quick toggle. Without a choice, phones keep the bottom bar and
  desktop and tablets keep the rail at the left. On a phone the rail sits on the thumb side: right, or left in
  left-handed mode. When the phone has no bottom bar, the open tasks tray moves to the bottom edge and the add
  button floats above it. The scenarios without a viewport tag run on the phone only (`@mobile`).

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And the calendar contains a task list "Groceries" on 2026-10-12 with items:
      | item | done |
      | Milk | no   |

  @mobile
  Scenario: The phone keeps the bottom bar by default
    When I open the month view for 2026-10
    Then the view switcher is in the "bottom" position
    And the view switcher is at the bottom of the screen

  @mobile
  Scenario: Choosing the top view switcher on a phone
    Given the view switcher on phones is set to "top"
    When I open the month view for 2026-10
    Then the view switcher is in the "top" position
    And the view switcher is directly under the top bar
    And the view switcher is above the calendar
    And there is no bottom bar
    And the view switcher shows "Year, Month, Week, Day, Tasks, Clock"

  @mobile
  Scenario: Switching the view still works from the top view switcher
    Given the view switcher on phones is set to "top"
    When I open the month view for 2026-10
    And I switch to the week view
    Then the URL path is "/week/2026-10-12"
    And the view switcher is in the "top" position

  @mobile
  Scenario: Choosing the rail on a phone puts it on the thumb side
    Given the view switcher on phones is set to "rail"
    When I open the month view for 2026-10
    Then the view switcher is in the "rail" position
    And the view switcher is on the "right" side of the screen
    And there is no bottom bar

  @mobile
  Scenario: In left-handed mode the rail on a phone is on the left
    Given the view switcher on phones is set to "rail"
    And left-handed mode is on
    When I open the month view for 2026-10
    Then the view switcher is in the "rail" position
    And the view switcher is on the "left" side of the screen

  @mobile
  Scenario Outline: Left-handed mode keeps working with every position
    Given the view switcher on phones is set to "<position>"
    And left-handed mode is on
    When I open the month view for 2026-10
    Then the "create button" is on the "left" side of the screen
    And the "tray toggle" is on the "left" side of the screen
    And the "settings button" is on the "left" side of the screen

    Examples:
      | position |
      | bottom   |
      | top      |
      | rail     |

  @mobile
  Scenario: The choice is made in the settings and follows the person
    When I open the month view for 2026-10
    And I open the settings
    And I choose "Top" as the view switcher position on phones
    And I leave the settings
    Then the view switcher is in the "top" position
    When I switch to another device
    And I open the month view for 2026-10
    Then the view switcher is in the "top" position

  @mobile
  Scenario Outline: The tray moves to the bottom edge without the bottom bar
    Given the view switcher on phones is set to "<position>"
    When I open the month view for 2026-10
    Then the open tasks tray is at the bottom of the screen
    And the add button is above the open tasks tray

    Examples:
      | position |
      | top      |
      | rail     |

  @mobile
  Scenario: With the bottom bar the open tasks are a slim row inside the bar
    When I open the month view for 2026-10
    Then the open tasks row is inside the bottom bar

  @mobile
  Scenario Outline: The add button never covers the view switcher
    Given the view switcher on phones is set to "<position>"
    When I open the month view for 2026-10
    Then the add button covers no control of the "view switcher"

    Examples:
      | position |
      | top      |
      | rail     |

  @mobile
  Scenario: The add button never covers the rail in left-handed mode
    Given the view switcher on phones is set to "rail"
    And left-handed mode is on
    When I open the month view for 2026-10
    Then the add button covers no control of the "view switcher"

  @mobile
  Scenario: The add button does not cover the open tasks tray without the bottom bar
    Given the view switcher on phones is set to "top"
    When I open the week view for 2026-10-12
    And I open the open tasks tray
    Then the create button does not cover any control of the open tasks tray

  @desktop
  Scenario: Desktop keeps the rail by default
    When I open the month view for 2026-10
    Then the view switcher is in the "rail" position
    And the view switcher is on the "left" side of the screen

  @desktop
  Scenario: The desktop choice does not depend on the phone choice
    Given the view switcher on phones is set to "top"
    When I open the month view for 2026-10
    Then the view switcher is in the "rail" position

  @desktop
  Scenario: Choosing the top view switcher on desktop
    Given the view switcher on desktop and tablets is set to "top"
    When I open the month view for 2026-10
    Then the view switcher is in the "top" position
    And the view switcher is directly under the top bar
    And there is no bottom bar

  @desktop
  Scenario: Choosing the bottom bar on desktop
    Given the view switcher on desktop and tablets is set to "bottom"
    When I open the month view for 2026-10
    Then the view switcher is in the "bottom" position
    And the view switcher is at the bottom of the screen
    And the add button covers no control of the "view switcher"
