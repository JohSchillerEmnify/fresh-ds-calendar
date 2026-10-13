@themes @id:theme-menu
Feature: Choosing and fine-tuning a theme
  A theme menu has three sections, in this order. "Presets" is a gallery of ready themes, each card drawn as a small
  week in that theme's real look. "Scene" is the top app bar background (one choice: Season, which is automatic, or
  any single scene: Spring, Easter, Summer, Summer holidays, Fall, Halloween, Christmas, New Year's Eve, New Year,
  Winter, Sunflower field, Mordor or None). "Fine-tuning" is where every option shows itself as a small sample before it is picked: theme mode, seed
  colour, glow (off, soft, neon), entries (solid, tinted, outline) and corners (square, round, pill). There is no
  separate Mordor button; the Mordor preset does the same. A live preview with a
  real event, task list and checkbox follows every change, and so does the calendar, without a save button. Ready
  themes: Default, Neon, Spring, Easter, Summer, Summer holidays, Fall, Halloween, Christmas, New Year's Eve, New Year,
  Winter, Mordor and Automatic, which follows the calendar in this priority: New Year's Eve (31 December), New Year
  (1 January), Christmas (from the 1st Advent Sunday to 30 December), Easter (a week before to six days after Easter
  Sunday), Halloween (all of October), then the season (spring from 1 March, summer from 1 June, fall from
  1 September, winter from 1 December). Summer holidays is never picked by Automatic. Christmas shows an Advent wreath
  with four candles, lit one more each Advent Sunday, and a tree on the left whose lights come on on 24 December. For
  Automatic the person chooses what follows the calendar: colours and scene, only the scene (colours from a base
  theme they pick) or only the colours (the scene stays their own pick). The choice is kept per person and
  holds on every device.

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00

  Scenario: A preset with my own colour, and back to the preset
    When I open the week view for 2026-10-12
    And I open the theme menu
    And I choose the theme "Neon"
    And I choose the seed color preset "Green"
    Then the color role "primary" has a hue within 15 degrees of "#386a20"
    And the theme "Neon" is marked as chosen
    And the event "Dentist" glows
    When I choose the theme "Neon"
    Then the color role "primary" has a hue within 15 degrees of "#9d4dff"

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
      | 2027-01-02 | Winter |

  Scenario Outline: Automatic follows the calendar through the holidays
    Given today is <date>
    And I chose the theme "Automatic"
    When I open the week view for <date>
    Then the top bar shows the "<scene>" scene

    Examples:
      | date       | scene       |
      | 2026-11-29 | christmas   |
      | 2026-12-20 | christmas   |
      | 2026-12-24 | christmas   |
      | 2026-12-31 | newyearseve |
      | 2027-01-01 | newyear     |
      | 2027-01-02 | winter      |
      | 2027-03-25 | easter      |
      | 2027-10-12 | halloween   |

  Scenario Outline: The Advent wreath lights a candle each Advent Sunday and the tree lights come on at Christmas Eve
    Given today is <date>
    And I chose the theme "Automatic"
    When I open the week view for <date>
    Then the advent wreath shows <candles> lit candles
    And the Christmas tree lights are <lights>

    Examples:
      | date       | candles | lights |
      | 2026-11-29 | 1       | off    |
      | 2026-12-06 | 2       | off    |
      | 2026-12-13 | 3       | off    |
      | 2026-12-20 | 4       | off    |
      | 2026-12-24 | 4       | on     |
      | 2026-12-30 | 4       | on     |

  Scenario: The Christmas scene picked by hand outside its dates shows the full Christmas
    Given today is 2026-04-12
    When I open the week view for 2026-04-12
    And I open the theme menu
    And I pick "Christmas" for "Scene"
    Then the top bar shows the "christmas" scene
    And the advent wreath shows 4 lit candles
    And the Christmas tree lights are on

  Scenario: Summer holidays can only be picked by hand
    Given today is 2026-07-10
    When I open the week view for 2026-07-10
    And I open the theme menu
    And I choose the theme "Summer holidays"
    Then the top bar shows the "summerholidays" scene
    And the theme "Summer holidays" is marked as chosen

  Scenario: Automatic can change only the scene, on colours I choose
    Given today is 2026-12-24
    And I chose the theme "Automatic"
    When I open the week view for 2026-12-24
    And I open the theme menu
    And I let Automatic change "Scene only"
    And I use "Neon" as the base for Automatic
    Then the color role "primary" has a hue within 15 degrees of "#9d4dff"
    And the top bar shows the "christmas" scene
    And the Christmas tree lights are on

  Scenario: Automatic can change only the colours
    Given today is 2026-12-24
    And I chose the theme "Automatic"
    When I open the week view for 2026-12-24
    And I open the theme menu
    And I let Automatic change "Colours only"
    Then the color role "primary" has a hue within 15 degrees of "#c62828"
    And the top bar shows no scene

  Scenario: The settings show what Automatic changes
    Given today is 2026-12-24
    And I chose the theme "Automatic"
    When I open the week view for 2026-12-24
    And I open the theme menu
    And I let Automatic change "Scene only"
    And I open the settings
    Then the settings show the theme "Automatic (scene) · Christmas"

  Scenario: The menu has three sections
    When I open the week view for 2026-10-12
    And I open the theme menu
    Then the theme menu sections are "Presets", "Scene" and "Fine-tuning"

  Scenario: The scene has its own section with one choice
    When I open the week view for 2026-10-12
    And I open the theme menu
    Then the scene choices are "Season, Spring, Easter, Summer, Summer holidays, Fall, Halloween, Christmas, New Year's Eve, New Year, Winter, Sunflower field, Mordor, None"

  Scenario: I can pick the Halloween scene in spring
    Given today is 2026-04-12
    When I open the week view for 2026-04-12
    And I open the theme menu
    And I pick "Halloween" for "Scene"
    Then the top bar shows the "halloween" scene

  Scenario: Season stays the automatic choice
    Given today is 2026-04-12
    When I open the week view for 2026-04-12
    And I open the theme menu
    And I pick "Halloween" for "Scene"
    And I pick "Season" for "Scene"
    Then the top bar shows the "spring" scene

  Scenario: The Mordor preset replaces the old Mordor button
    When I open the week view for 2026-10-12
    And I open the theme menu
    And I choose the theme "Mordor"
    Then the theme menu has no Mordor button
    And the app uses the dark theme
    And the top bar shows the "mordor" scene

  Scenario: Picking a scene changes the top bar
    When I open the week view for 2026-10-12
    And I open the theme menu
    And I pick "Mordor" for "Scene"
    Then the top bar shows the "mordor" scene
    When I pick "Sunflower field" for "Scene"
    Then the top bar shows the "sunflowers" scene
    When I pick "None" for "Scene"
    Then the top bar shows no scene

  Scenario: The settings show which seasonal theme the automatic theme uses
    Given today is 2026-10-12
    And I chose the theme "Automatic"
    When I open the week view for 2026-10-12
    And I open the settings
    Then the settings show the theme "Automatic · Halloween"

  Scenario: A fixed theme shows its own name in the settings
    Given I chose the theme "Neon"
    When I open the week view for 2026-10-12
    And I open the settings
    Then the settings show the theme "Neon"
