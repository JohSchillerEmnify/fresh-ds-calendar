@backup @settings @settings-expressive @mobile @id:drive-backup-settings
Feature: The backup actions in Settings are expressive buttons
  Owner, 2026-11-09 (feature settings-expressive): row actions are tonal buttons, and paired actions are one connected
  button group.

  Background:
    Given the time is 2026-10-12 08:00
    And "jo@example.com" and "anna@example.com" may use the calendar

  Scenario: Sign out and Sign out everywhere are tonal buttons
    Given "jo@example.com" is signed in
    When I open the settings
    And I open the settings group "Account & app"
    Then the button "Sign out" in the settings is a tonal button
    And the button "Sign out everywhere" in the settings is a tonal button
    And no button of the settings screen is filled

  Scenario: Back up now and Restore are a connected button group
    Given "jo@example.com" is signed in
    When I open the settings
    And I open the settings group "Account & app"
    Then "Back up now" and "Restore from backup" are one connected button group in the settings
