@themes @theme-save-own @id:theme-save-own
Feature: Saving my fine-tuned look as my own theme
  Whatever look I have put together in the theme menu (a theme, my fine-tuning, the scene) I can keep as my own theme
  (owner, 2026-10-13): "Save as my theme" asks for a name and saves the look as a theme of mine. It becomes the chosen
  theme, appears in the gallery next to the ready ones, and follows me to every device. This does not need the Labs
  switch for the AI prompt and import.

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And "jo@example.com" may use the calendar

  Scenario: I save my fine-tuned look as my own theme and it appears in the gallery and follows me to another device
    Given "jo@example.com" chose the theme "Neon"
    When I pick "Soft" for "Glow"
    And I save my look as my own theme named "Night"
    Then the theme "Night" is in use
    And the gallery offers the theme "Night"
    And my own theme "Night" has "glow" set to "soft"
    When "jo@example.com" opens the week view for 2026-10-12 on another device
    And I open the theme menu
    Then the gallery offers the theme "Night"
    And the theme "Night" is in use
