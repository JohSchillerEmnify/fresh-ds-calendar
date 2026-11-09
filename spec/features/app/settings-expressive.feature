@settings @settings-expressive @mobile @id:settings-expressive
Feature: Settings in Material 3 Expressive
  Owner, 2026-11-09: "The material expressive redesign is incomplete because you did not do it in the settings."
  The approved mockup (owner: "looks good to me with the mockup") has seven decisions: every section is one rounded
  container, on phones and on wider screens (a centred column of at most 640 px there); every native select is an
  outlined field with a menu; a value that opens a page is grey with a chevron, a value edited in place is a tonal
  button; up to 4 short options are one connected button group that stacks when the labels do not fit, more options or
  long labels are a field with a menu; the settings home lists its groups in one container with 40 px tonal icons; the
  settings bar follows the top bar size (64 px Expressive, 56 px Compact). The content stays as it is: no setting is
  added or removed, no text changes. ADR 0032.

  Background:
    Given the calendar is empty
    And today is 2026-11-04

  Rule: Settings has the same bars and containers as the rest of the app

    Scenario: The settings bar is an expressive top bar
      Given the top bar size is set to "Expressive"
      When I open the settings
      Then the settings title "Settings" is bold at 28 px in a 64 px bar
      And the settings Back button is a tonal round icon button
      And the settings bar shows no scene

    Scenario: The settings bar follows the compact top bar size
      Given the top bar size is set to "Compact"
      When I open the settings
      Then the settings bar is 56 px high

    Scenario: Rows of a group sit in rounded containers
      When I open the settings
      And I open the settings group "Views"
      Then the section "Views in the switcher" is one rounded container
      And the rows of the section "Views in the switcher" are 64 px high at least
      And the settings page shows the section "General"
      And the section containers are another tone than the page

    Scenario: The group list on the settings home is one container
      When I open the settings
      Then the settings groups "Calendars, Views, Task lists, Reminders, Appearance & layout, Focus & calm, Labs, Account & app" are items of one rounded container
      And every settings group shows a 40 px tonal icon

    Scenario: The settings search is the expressive search bar
      When I open the settings
      Then the settings search bar is full round and 56 px high
      When I search the settings for "theme"
      Then the settings search shows "Theme" in "Appearance & layout"

  Rule: Every action in Settings follows the one action vocabulary

    Scenario: Row actions are tonal buttons
      When I open the settings
      And I open the settings group "Account & app"
      Then the button "Download" in the settings is a tonal button
      And no button of the settings screen is filled

    Scenario: A choice of few options is a connected button group
      When I open the settings
      And I open the settings group "Appearance & layout"
      Then "Top bar size" offers "Automatic, Expressive, Compact" as a connected button group
      And "Automatic" is chosen for "Top bar size" in the settings

    Scenario: Options that do not fit one line stack
      When I open the settings
      And I open the settings group "Task lists"
      Then the options of "Finished list without a date" show their full labels on whole lines

    Scenario: The icon sets of the theme fit on a phone
      When I open the settings
      And I open the setting "Theme"
      Then the options of the theme setting "Icon set" show their full labels on whole lines

    Scenario: A value that opens a page is grey with a chevron
      When I open the settings
      And I open the settings group "Appearance & layout"
      Then the row "Theme" shows a grey value and a chevron

    Scenario: A value edited in place is a tonal button
      When I open the settings
      And I open the settings group "Reminders"
      And I turn on "Morning overview" in the settings
      Then the value of "Time of the overview" is a tonal button

  Rule: Menus and fields are the expressive ones

    Scenario: A select is an outlined field with a menu
      When I open the settings
      And I open the settings group "Views"
      Then "Default view" is an outlined field showing "Month"
      When I open the field "Default view"
      Then the menu lists "Month, Week, Day" and marks "Month" as chosen

    Scenario: Choosing in the menu closes it and saves
      When I open the settings
      And I open the settings group "Views"
      And I open the field "Default view"
      And I choose "Week" in the menu
      Then the menu is closed
      And "Default view" is an outlined field showing "Week"

    Scenario: A long list scrolls inside its menu
      When I open the settings
      And I open the settings group "Appearance & layout"
      And I open the field "Language"
      Then the menu stays inside the screen

  Rule: Settings looks right at the phone size, in light and dark

    @visual
    Scenario Outline: The settings home is tidy
      Given the device prefers a <scheme> color scheme
      When I open the settings
      Then no text in the "settings page" is clipped
      And the "settings page" still looks like "settings-home-<scheme>"

      Examples:
        | scheme |
        | light  |
        | dark   |

    @visual
    Scenario Outline: A settings group page is tidy
      Given the device prefers a <scheme> color scheme
      When I open the settings
      And I open the settings group "<group>"
      Then no text in the "settings page" is clipped
      And the "settings page" still looks like "settings-<name>-<scheme>"

      Examples:
        | group              | name       | scheme |
        | Views              | views      | light  |
        | Views              | views      | dark   |
        | Account & app      | account    | light  |
        | Account & app      | account    | dark   |
        | Appearance & layout | appearance | light  |
        | Appearance & layout | appearance | dark   |

    @visual
    Scenario Outline: The theme page is tidy
      Given the device prefers a <scheme> color scheme
      When I open the settings
      And I open the setting "Theme"
      Then the "theme page" still looks like "settings-theme-<scheme>"

      Examples:
        | scheme |
        | light  |
        | dark   |
