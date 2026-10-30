@settings @id:settings
Feature: Settings
  A Settings screen (from the settings button in the top app bar, or /settings) lets the owner
  choose the theme mode (System, Light, Dark), the seed color the whole Material 3 color scheme
  is generated from (8 presets or a custom hex), the default view and the default event color.
  Settings are stored on the server, so they survive reloads and apply on every device.

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And the seasons and holidays are off

  @smoke
  Scenario: The settings screen is reachable from the top app bar
    When I open the week view for 2026-10-12
    And I open the settings
    Then the settings screen is shown
    And the URL path is "/settings"
    When I leave the settings
    Then the URL path is "/week/2026-10-12"

  Scenario: Default settings on first run
    When I open the path "/settings"
    Then the theme mode "System" is selected
    And the seed color "Blue" is selected
    And the default view "Month" is selected
    And the default event color "Calendar color" is selected
    And the settings show up to 4 events side by side in the day view
    And the settings show up to 2 events side by side in the week view
    And the categories are "Shopping, To-do, Work, Home"

  Scenario Outline: The theme mode overrides the system color scheme
    Given the device prefers a <system> color scheme
    When I open the path "/settings"
    And I choose the theme mode "<mode>"
    Then the app uses the <result> theme
    When I reload the page
    Then the app uses the <result> theme

    Examples:
      | system | mode   | result |
      | light  | Dark   | dark   |
      | dark   | Light  | light  |
      | dark   | System | dark   |

  Scenario Outline: Choosing a seed color preset recolors the whole UI
    When I open the path "/settings"
    And I choose the seed color preset "<preset>"
    Then the seed color "<preset>" is selected
    And the color role "primary" has a hue within 15 degrees of "<hex>"
    And the color role "secondary-container" has a hue within 30 degrees of "<hex>"
    When I open the week view for 2026-10-12
    Then the color role "primary" has a hue within 15 degrees of "<hex>"

    Examples:
      | preset | hex     |
      | Blue   | #1a73e8 |
      | Purple | #6750a4 |
      | Teal   | #006a6a |
      | Green  | #386a20 |
      | Orange | #e8710a |
      | Red    | #b3261e |
      | Pink   | #c2185b |
      | Slate  | #4f6170 |

  Scenario: A custom seed color recolors the UI in light and dark mode
    Given the device prefers a light color scheme
    When I open the path "/settings"
    And I enter the custom seed color "#8e24aa"
    Then the seed color "Custom" is selected
    And the color role "primary" has a hue within 15 degrees of "#8e24aa"
    When I choose the theme mode "Dark"
    Then the color role "primary" has a hue within 15 degrees of "#8e24aa"
    And the page theme color matches the "surface" color role

  @validation
  Scenario Outline: An invalid custom seed color is rejected
    When I open the path "/settings"
    And I enter the custom seed color "<value>"
    Then the custom seed color field shows the error "Enter a color like #1a73e8"
    And the seed color "Blue" is selected

    Examples:
      | value   |
      | #12345  |
      | blue    |
      | #gg0000 |

  Scenario: Theme mode and seed colour are stored on the server and apply on another device
    When I open the path "/settings"
    And I choose the theme mode "Dark"
    And I choose the seed color preset "Green"
    And I switch to another device
    And I open the app
    Then the app uses the dark theme
    And the color role "primary" has a hue within 15 degrees of "#386a20"
    When I request "GET /api/settings"
    Then the response JSON field "themeMode" equals "dark"
    When I request "GET /api/prefs/theme"
    Then the response JSON field "overrides.seed" equals "#386a20"

  Scenario Outline: The default view decides where the app opens
    When I open the path "/settings"
    And I choose "<view>" as the default view
    And I open the app
    Then the URL path is "<path>"

    Examples:
      | view  | path             |
      | Week  | /week/2026-10-12 |
      | Day   | /day/2026-10-12  |
      | Month | /month/2026-10   |

  Scenario: The default event color is used for new events
    When I open the path "/settings"
    And I choose "Tomato" as the default event color
    And I open the week view for 2026-10-12
    And I start creating an event
    Then the event form shows:
      | color | Tomato |

  Scenario: Settings changes made on another device appear after the app regains focus
    When I open the week view for 2026-10-12
    And the settings are changed elsewhere to the theme mode "Dark"
    And the app regains focus
    Then the app uses the dark theme

  Scenario: Every setting appears once, in its section
    When I open the settings
    Then the settings sections are "Appearance, Calendar, Task lists, Focus & motivation, Motion & sound, Bedtime, Notifications, Labs, Account & data"
    And the settings page has no theme mode or seed colour controls

  Scenario: The version is shown in the settings and, if I want, in the corner
    Given the server reports the build version "0.4.2+abc1234"
    When I open the settings
    Then the settings show the version "0.4.2"
    When I turn on "Show version in the corner" in the settings
    And I open the week view for 2026-10-12
    Then the corner shows the version "0.4.2"

  Scenario: The settings show the signing certificate of the app the server offers
    Given the server offers an app signed with the certificate "ab12cd34ab12cd34ab12cd34ab12cd34ab12cd34ab12cd34ab12cd34ab12cd34"
    When I open the settings
    Then the settings show the app certificate "ab12cd34ab12cd34ab12cd34ab12cd34ab12cd34ab12cd34ab12cd34ab12cd34"

  @no-sideways
  Scenario Outline: Settings pages do not scroll sideways on a small phone
    Given the screen is 320 pixels wide
    When I open the settings page "<page>"
    Then the page cannot be scrolled sideways
    And no settings row is wider than the screen

    Examples:
      | page               |
      | /settings          |
      | /settings/theme    |
      | /settings/reminders |

  Scenario: A setting that cannot be saved goes back to what it was
    Given I open the path "/settings"
    And the network connection is lost
    When I choose "Week" as the default view
    Then the default view "Month" is selected
    And I see the sync error banner
