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

  Scenario: A fine-tuned look with slider values and icon choices keeps them when saved as my theme
    When I open the week view for 2026-10-12
    And I open the theme menu
    And I set the "Corner radius" slider to 4
    And I set the "Glow strength" slider to 70
    And I set the "Entry tint" slider to 30
    And I choose "Compact" for the "Density" setting
    And I choose "Square" for the "Checkbox shape" setting
    And I choose "Cross" for the "Check mark" setting
    And I save my look as my own theme named "Fine"
    Then my own theme "Fine" has "radius" set to "4"
    And my own theme "Fine" has "glowStrength" set to "70"
    And my own theme "Fine" has "tint" set to "30"
    And my own theme "Fine" has "density" set to "compact"
    And my own theme "Fine" has "checkbox" set to "square"
    And my own theme "Fine" has "check" set to "cross"
    And the "Corner radius" slider shows "4 px"

