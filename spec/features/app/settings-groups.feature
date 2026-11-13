@settings @settings-groups @id:settings-groups
Feature: Settings in a few groups
  Owner, 2026-11-01: "settings are all over the place; needs a full audit, good grouping and a settings search".
  The Settings screen opens on a short list of groups, each with an icon, its name and a one-line summary, and a
  search bar on top. A group opens as its own page; inside, settings are list items (name, supporting text, the
  control at the end) under small section headers. Every setting appears in exactly one group (structure:
  docs/settings-tree.md, audit: docs/settings-audit.md). Each calendar has its own page with its switch, its colour (feature calendar-colours), its plan
  (feature calendar-off-plan) and its default reminders. The look is Material 3 Expressive (ADR 0032): no filled
  button on a settings page, choices with more than three options open a menu, times open the time picker.
  Replaces the one long page of nine cards; when built, the scenario "Every setting appears once, in its section" of
  feature settings is replaced by these.

  Background:
    Given the calendar is empty
    And today is 2026-11-04

  Rule: The settings home lists a few groups

    Scenario: The settings home shows the groups and a search bar
      When I open the settings
      Then the settings groups are "Calendars, Views, Task lists, Reminders, Appearance & layout, Focus & calm, Widgets, Labs, Account & app"
      And the settings home shows the search bar

    Scenario: A group opens as its own page and Back returns to the groups
      When I open the settings
      And I open the settings group "Views"
      Then the settings group page "Views" is shown
      And the settings page shows the setting "Default view"
      And the settings page shows the setting "Minimum event length"
      When I go back in the settings
      Then the settings home is shown

    Scenario: Layout settings are under Appearance & layout, not under Views
      When I open the settings
      And I open the settings group "Appearance & layout"
      Then the settings page shows the setting "Left-handed mode"
      And the settings page shows the setting "Top bar size"
      When I go back in the settings
      And I open the settings group "Views"
      Then the settings page does not show the setting "Left-handed mode"

  Rule: Settings that only matter with another one on are shown with it

    Scenario: The Approaching card's details hide while the card is off
      When I open the settings
      And I open the settings group "Views"
      And I turn off "Approaching card" in the settings
      Then the settings page does not show the setting "Time left"
      And the settings page does not show the setting "Approaching track"
      When I turn on "Approaching card" in the settings
      Then the settings page shows the setting "Time left"

  Rule: Widgets have a group of their own, one section per platform

    Scenario: The Widgets group has an iPhone and an Android section
      When I open the settings
      And I open the settings group "Widgets"
      Then the settings group page "Widgets" is shown
      And the settings page shows the section "iPhone"
      And the settings page shows the section "Android"

    Scenario: The Android section explains the home-screen widgets and links the app
      When I open the settings
      And I open the settings group "Widgets"
      Then the settings page shows the setting "Home screen widgets"
      And the button "Download" in the settings is a tonal button

    Scenario: The iPhone widget is in Widgets, not in Account & app
      When I open the settings
      And I open the settings group "Account & app"
      Then the settings page does not show the section "iPhone widget"
      And the settings page does not show the section "iPhone"

    Scenario: Search finds the iPhone widget under Widgets
      When I open the settings
      And I search the settings for "lock screen"
      Then the settings search shows "Lock screen circle" in "Widgets"

    # Shared settings are, for example, the number of days of a timeline view (issues 96 and 107); the section sits above iPhone and Android
    @backlog
    Scenario: Settings that both platforms share appear above the two sections
      When I open the settings
      And I open the settings group "Widgets"
      Then the settings page shows the section "Shared"

  Rule: Each calendar has its own settings page

    Scenario: A calendar's page holds its switch, its colour, its plan and its reminders
      Given the calendar contains an event "Standup" in the calendar "Work" on 2026-11-04 from 09:00 to 09:15
      When I open the settings
      And I open the settings group "Calendars"
      And I open the calendar "Work" in the settings
      Then the settings page shows the setting "Show this calendar"
      And the settings page shows the setting "Color"
      And the settings page shows the setting "Plan"
      And the settings page shows the setting "Default reminders"

    Scenario: A plan set on the calendar's page shows on the Calendars page and switches the calendar
      Given the calendar contains an event "Standup" in the calendar "Work" on 2026-11-04 from 09:00 to 09:15
      And the time is 2026-11-04 07:00
      When I open the settings
      And I open the settings group "Calendars"
      And I open the calendar "Work" in the settings
      And I open the setting "Plan"
      And I choose "Off at set times" in the calendar sheet
      And I set the off time from "Wed" 08:00 to "Wed" 20:00 in the calendar sheet
      And I choose "Done" in the calendar sheet
      Then the settings show the plan "Off Wed 08:00 – Wed 20:00" for the calendar "Work"
      When the time is 2026-11-04 09:00
      And I open the week view for 2026-11-02
      Then I do not see the event "Standup"

  Rule: One setting, one control

    Scenario: Task list reminders are switched in one place only
      When I open the settings
      And I search the settings for "task lists with a time"
      Then the settings search shows 1 result
      And the settings search shows "Before task lists with a time" in "Reminders"

    Scenario: The bedtime reminder is one choice in Bedtime
      When I open the settings
      And I search the settings for "bedtime reminder"
      Then the settings search shows 1 result
      And the settings search shows "Reminder" in "Focus & calm › Bedtime"

    Scenario: The bar size can go back to Automatic
      When I open the settings
      And I open the settings group "Appearance & layout"
      And I choose "Compact" for "Top bar size" in the settings
      And I choose "Automatic" for "Top bar size" in the settings
      Then "Automatic" is chosen for "Top bar size" in the settings

  Rule: The settings follow Material 3 Expressive

    Scenario: Settings rows are list items with the control at the end
      When I open the settings
      And I open the settings group "Views"
      Then every settings row shows its name first and its control at the end
      And no button of the settings screen is filled

    Scenario: A time is chosen with the time picker
      When I open the settings
      And I open the settings group "Reminders"
      And I turn on "Morning overview" in the settings
      And I open the setting "Time of the overview"
      Then the time picker is shown
      And the time picker fields are 56 px high text fields
