@themes @theme-own-labs @id:theme-own-labs
Feature: Creating own themes with an AI is an experiment behind a Labs switch
  Importing my own theme is always in the theme menu (owner, 2026-10-18). Making one with an AI is not refined yet, so
  the prompt for an AI is offered only when I turn on "Generate themes with AI" in the Labs part of the settings (under
  the experimental master switch). Switched off, the theme menu has the import but no prompt; my saved own themes
  show in the gallery and the one I chose keeps applying.

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And "jo@example.com" may use the calendar
    And "jo@example.com" imported the theme file "ocean.json"
    And the seasons and holidays are off

  Scenario: Without the switch there is no AI prompt, but the import and my themes show
    When "jo@example.com" opens the week view for 2026-10-12 on another device
    And I open the theme menu
    Then the theme menu has the import block
    And the theme menu has no AI prompt
    And the gallery offers the theme "Ocean"

  Scenario: Turning the switch on offers the AI prompt
    When "jo@example.com" opens the week view for 2026-10-12 on another device
    And I turn on the AI theme prompt in the settings
    And I open the theme menu
    Then the theme menu has an AI prompt
    And the theme menu has the import block
    And the gallery offers the theme "Ocean"

  Scenario: A chosen own theme applies with the switch off
    Given "jo@example.com" uses the imported theme "Ocean"
    When "jo@example.com" opens the week view for 2026-10-12 on another device
    Then the theme "Ocean" is in use
