@themes @theme-import @id:theme-import
Feature: Making my own theme with an AI and importing it
  Besides the ready themes I can make my own (owner, 2026-10-13): the theme menu offers "Create with AI", which gives
  me a prompt to copy into the AI I like. The AI answers with a theme file; I paste it or upload it, the app checks
  it, shows what is wrong in plain words or a preview of how it looks, and I can save it. Saved themes are mine,
  appear in the gallery on every device, and can be exported or deleted. A theme may bring its own picture for the
  top bar; anything unsafe in it is removed before it is shown.

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00

  Scenario: The AI prompt is ready to copy
    When I open the theme menu
    And I choose "Create with AI"
    Then I see a prompt that describes the theme file "calendar-theme/1"
    And I can copy the prompt

  Scenario: A valid theme is previewed and then saved
    When I open the theme menu
    And I import the theme file "ocean.json"
    Then the import preview shows the theme "Ocean"
    When I save the imported theme
    Then the theme "Ocean" is in use
    And the gallery offers the theme "Ocean"

  Scenario: A broken theme is refused with a readable reason
    When I open the theme menu
    And I paste the theme text '{"schema":"calendar-theme/1","name":"X","glow":"ultra"}'
    Then the import says "glow must be one of off, soft, neon"
    And I cannot save the imported theme

  Scenario: Unsafe parts of a theme picture are removed
    When I open the theme menu
    And I import the theme file "sneaky.json"
    Then the import preview shows the theme "Sneaky"
    And the import notes that unsafe content was removed
    And no script from the theme runs

  Scenario: My own theme follows me and can be deleted
    Given "jo@example.com" may use the calendar
    And "jo@example.com" imported the theme file "ocean.json"
    When "jo@example.com" opens the week view for 2026-10-12 on another device
    And I open the theme menu
    Then the gallery offers the theme "Ocean"
    When I delete the theme "Ocean"
    Then the gallery does not offer the theme "Ocean"
