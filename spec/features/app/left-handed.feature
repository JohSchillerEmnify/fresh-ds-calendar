@left-hand @id:left-handed-mode
Feature: Left-handed mode
  A person who holds the phone in the left hand reaches the main controls with the left thumb, so a switch in the
  settings ("Left-handed mode", off by default, kept per person, so it follows them to every device) mirrors the
  controls of the phone layout: the add button and the open tasks tray toggle, snackbar and dialog actions, the
  settings button and the navigation in the top bar, the settings switches, the version label and the cats. Only the
  controls move. The time axis, the grid order, swipe directions and text stay as they are, and the desktop layout
  does not change at all. The same applies to a tablet (a touch device up to about 1366 px, `(pointer: coarse)`), where the side tray moves
  next to the navigation rail at the left. The scenarios without a viewport tag run on the phone only (`@mobile`).

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00

  @mobile
  Scenario: Switching it on moves the add button and the tray toggle to the left
    When I open the month view for 2026-10
    And I turn on "Left-handed mode" in the settings
    And I leave the settings
    Then the "create button" is on the "left" side of the screen
    And the "tray toggle" is on the "left" side of the screen

  @mobile
  Scenario: It follows the person to another device
    When I open the month view for 2026-10
    And I turn on "Left-handed mode" in the settings
    And I switch to another device
    And I open the month view for 2026-10
    Then the "create button" is on the "left" side of the screen

  @mobile
  Scenario: The undo action of a snackbar is on the left
    Given left-handed mode is on
    When I open the week view for 2026-10-12
    And I open the event "Dentist"
    And I delete the event
    Then the "undo action" is on the "left" side of the screen

  @mobile
  Scenario: The settings button and the navigation swap sides in the top bar
    Given left-handed mode is on
    When I open the month view for 2026-10
    Then the "settings button" is on the "left" side of the screen
    And the "Today button" is on the "right" side of the screen

  @mobile
  Scenario: The switches in the settings are on the left
    Given left-handed mode is on
    When I open the month view for 2026-10
    And I open the settings
    Then the switches in the settings are on the "left" side of the screen

  @mobile
  Scenario: The time axis stays on the left
    Given left-handed mode is on
    When I open the week view for 2026-10-12
    Then the "time axis" is on the "left" side of the screen

  @mobile
  Scenario: The support cat comes in from the left
    Given left-handed mode is on
    And the support cat comes by on the next finished list
    And the calendar contains a task list "Groceries" on 2026-10-12 with items:
      | item | done |
      | Milk | no   |
    When I open the day view for 2026-10-12
    And I expand the task list "Groceries"
    And I tick the item "Milk"
    Then the support cat walks in from the "left"

  @tablet
  Scenario: On an iPad in left-handed mode the add button sits on the left
    Given left-handed mode is on
    When I open the month view for 2026-10
    Then the "create button" is on the "left" side of the screen
    And the "settings button" is on the "left" side of the screen
    And the "Today button" is on the "right" side of the screen

  @tablet
  Scenario: On an iPad in left-handed mode the open tasks tray sits next to the navigation rail at the left
    Given left-handed mode is on
    When I open the month view for 2026-10
    Then the "open tasks tray" is on the "left" side of the screen

  @desktop
  Scenario: The desktop layout does not change
    Given left-handed mode is on
    When I open the month view for 2026-10
    Then the "create button" is on the "right" side of the screen
    And the "settings button" is on the "right" side of the screen
    And the "open tasks tray" is on the "right" side of the screen
