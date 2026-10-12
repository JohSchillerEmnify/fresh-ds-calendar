@theme
Feature: Material 3 look and light/dark theme
  The UI follows Material 3 (Expressive): color roles as design tokens generated from one seed
  color, light and dark schemes that follow the system setting, M3 type scale, top app bar,
  navigation bar on phones, FAB, bottom sheets, chips and state layers.

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00

  Scenario Outline: The theme follows the system color scheme
    Given the device prefers a <scheme> color scheme
    When I open the week view for 2026-10-12
    Then the app uses the <scheme> theme
    And the page theme color matches the "surface" color role

    Examples:
      | scheme |
      | light  |
      | dark   |

  Scenario: Switching the system color scheme while the app is open updates the theme
    Given the device prefers a light color scheme
    When I open the week view for 2026-10-12
    And the device switches to a dark color scheme
    Then the app uses the dark theme

  Scenario Outline: Material color role tokens are defined in both themes
    Given the device prefers a <scheme> color scheme
    When I open the app
    Then the color roles "primary, on-primary, primary-container, on-primary-container, secondary-container, surface, on-surface, surface-container, surface-container-high, on-surface-variant, outline, error, on-error" are defined

    Examples:
      | scheme |
      | light  |
      | dark   |

  Scenario Outline: Events and task lists are filled with their colour like in Google Calendar
    Given the device prefers a <scheme> color scheme
    And the calendar contains a task list "Groceries" on 2026-10-14 at 12:00 with items:
      | item | done |
      | Milk | no   |
    When I open the week view for 2026-10-12
    Then the event "Dentist" is filled with its color
    And the task list "Groceries" is filled with its color
    And the task list "Groceries" has a text contrast ratio of at least 4.5

    Examples:
      | scheme |
      | light  |
      | dark   |

  Scenario Outline: Text stays readable in both themes
    Given the device prefers a <scheme> color scheme
    When I open the week view for 2026-10-12
    Then the period title has a contrast ratio of at least 4.5
    And the event "Dentist" has a text contrast ratio of at least 4.5

    Examples:
      | scheme |
      | light  |
      | dark   |

  Scenario: Pressing a button shows a state layer
    When I open the week view for 2026-10-12
    Then pressing the create button shows a state layer
