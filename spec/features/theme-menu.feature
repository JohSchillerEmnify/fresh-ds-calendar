@themes @id:theme-menu
Feature: Choosing and fine-tuning a theme
  A theme menu shows a gallery of ready themes, each card drawn as a small week in that theme's real look, and a
  fine-tuning section where every option shows itself as a small sample before it is picked: glow (off, soft, neon),
  entries (solid, tinted, outline), corners (square, round, pill) and the background scene. A live preview with a
  real event, task list and checkbox follows every change, and so does the calendar, without a save button. Ready
  themes: Default, Neon, Spring, Summer, Fall, Halloween, Winter, Mordor and Automatic, which follows the season
  (spring from 1 March, summer from 1 June, fall from 1 September, Halloween for all of October, fall again in
  November, winter from 1 December). The choice is kept per person and
  holds on every device.

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00

  Scenario: Choosing a theme from the gallery applies it at once
    When I open the week view for 2026-10-12
    And I open the theme menu
    And I choose the theme "Neon"
    Then the event "Dentist" glows
    And the theme "Neon" is marked as chosen

  Scenario: Each option shows how it looks before it is picked
    When I open the week view for 2026-10-12
    And I open the theme menu
    Then every option for "Entries" shows a sample event drawn in that style
    When I pick "Outline" for "Entries"
    Then the preview event is drawn as an outline
    And the event "Dentist" is drawn as an outline

  Scenario: My theme follows me to every device
    Given "jo@example.com" may use the calendar
    And "jo@example.com" chose the theme "Neon"
    When "jo@example.com" opens the week view for 2026-10-12 on another device
    Then the event "Dentist" glows

  Scenario Outline: The automatic theme follows the season
    Given today is <date>
    And I chose the theme "Automatic"
    When I open the week view for <date>
    Then the theme "<season>" is in use

    Examples:
      | date       | season |
      | 2026-04-10 | Spring |
      | 2026-07-10 | Summer |
      | 2026-10-12 | Halloween |
      | 2026-11-10 | Fall   |
      | 2026-12-10 | Winter |
