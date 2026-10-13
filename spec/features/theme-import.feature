@themes @theme-import @id:theme-import
Feature: Making my own theme with an AI and importing it
  Besides the ready themes I can make my own (owner, 2026-10-13), as an experiment behind a Labs switch: the theme
  menu offers "Create with AI", which gives me a short prompt to copy into the AI I like. The AI answers with a small
  theme file (colours, a few looks, a drawn top bar scene, no pictures in it); I paste it or upload it, the app
  tidies what chat programs do to it, checks it, shows what is wrong in plain words (and a prompt to ask the AI to
  repair it) or a preview of how it looks, and I can save it. Saved themes are mine, appear in the gallery on every
  device, and can be exported or deleted. Separately I can add my own SVG picture for the top bar; anything unsafe in
  it is removed before it is shown.

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    And own themes are turned on in Labs

  Scenario: The AI prompt is ready to copy
    When I open the theme menu
    And I choose "Create with AI"
    Then I see a prompt that describes the theme file "calendar-theme/2"
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
    And I paste the theme text '{"schema":"calendar-theme/2","name":"X","glow":"ultra"}'
    Then the import says "glow must be one of off, soft, neon"
    And I cannot save the imported theme
    And I can copy the repair prompt

  Scenario: Text that is not JSON gets a hint and a repair prompt
    When I open the theme menu
    And I paste the theme text 'Sure! Here is your theme: {"name": "X", }'
    Then the import says "This is not valid JSON. Ask the AI to answer with only the JSON in one code block."
    And I cannot save the imported theme
    And I can copy the repair prompt

  Scenario: An AI chat answer with a code fence and Markdown links still imports
    When I open the theme menu
    And I paste the AI answer "gemini-answer.txt"
    Then the import preview shows the theme "Lagoon"
    When I save the imported theme
    Then the gallery offers the theme "Lagoon"

  Scenario: The top bar draws the scene of the theme
    When I open the theme menu
    And I import the theme file "ocean.json"
    And I save the imported theme
    Then the top bar draws the decor "waves"

  Scenario: Unsafe parts of my own picture are removed
    When I open the theme menu
    And I import the theme file "ocean.json"
    And I upload the picture file "sneaky.svg"
    Then the import preview shows the theme "Ocean"
    And the import notes that unsafe content was removed
    And no script from the theme runs

  Scenario: My own picture replaces the drawn scene
    When I open the theme menu
    And I import the theme file "ocean.json"
    And I upload the picture file "sneaky.svg"
    And I save the imported theme
    Then the top bar shows the picture of the theme

  Scenario: My own theme follows me and can be deleted
    Given "jo@example.com" may use the calendar
    And "jo@example.com" imported the theme file "ocean.json"
    When "jo@example.com" opens the week view for 2026-10-12 on another device
    And I turn on own themes in the settings
    And I open the theme menu
    Then the gallery offers the theme "Ocean"
    When I delete the theme "Ocean"
    Then the gallery does not offer the theme "Ocean"
