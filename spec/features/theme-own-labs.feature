@themes @theme-own-labs @id:theme-own-labs
Feature: Creating own themes with an AI is an experiment behind a Labs switch
  Making my own theme with an AI is not refined yet (owner, 2026-10-13), so it is offered only when I turn on "Own
  themes (AI and import)" in the Labs part of the settings. Switched off, the theme menu has no prompt and no import;
  my saved own themes still show in the gallery and the one I chose keeps applying.

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And "jo@example.com" may use the calendar
    And "jo@example.com" imported the theme file "ocean.json"
    And the seasons and holidays are off

  Scenario: Without the switch there is no AI prompt and no import, but my themes show
    When "jo@example.com" opens the week view for 2026-10-12 on another device
    And I open the theme menu
    Then the theme menu has no block for creating own themes
    And the gallery offers the theme "Ocean"

  Scenario: Turning the switch on offers the AI prompt and the import
    When "jo@example.com" opens the week view for 2026-10-12 on another device
    And I turn on own themes in the settings
    And I open the theme menu
    Then the theme menu has a block for creating own themes
    And the gallery offers the theme "Ocean"

  Scenario: A chosen own theme applies with the switch off
    Given "jo@example.com" uses the imported theme "Ocean"
    When "jo@example.com" opens the week view for 2026-10-12 on another device
    Then the theme "Ocean" is in use
