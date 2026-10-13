@themes @theme-own-labs @id:theme-own-labs
Feature: Own themes are an experiment behind a Labs switch
  Making my own theme with an AI is not refined yet (owner, 2026-10-13), so it is offered only when I turn on "Own
  themes (AI and import)" in the Labs part of the settings. Switched off, the theme menu shows no part for it and no
  imported themes; themes I already saved stay saved, and the one I chose keeps applying.

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And "jo@example.com" may use the calendar
    And "jo@example.com" imported the theme file "ocean.json"

  Scenario: Without the switch the theme menu has no own themes
    When "jo@example.com" opens the week view for 2026-10-12 on another device
    And I open the theme menu
    Then the theme menu has no block for own themes
    And the gallery does not offer the theme "Ocean"

  Scenario: Turning the switch on brings them back
    When "jo@example.com" opens the week view for 2026-10-12 on another device
    And I turn on own themes in the settings
    And I open the theme menu
    Then the theme menu has a block for own themes
    And the gallery offers the theme "Ocean"

  Scenario: A chosen own theme keeps applying with the switch off
    Given "jo@example.com" uses the imported theme "Ocean"
    When "jo@example.com" opens the week view for 2026-10-12 on another device
    Then the theme "Ocean" is in use
