@themes @id:theme-menu
Feature: Choosing and fine-tuning a theme
  A theme menu has four sections, in this order. "Seasons & holidays" is one setting for all seasons and holidays,
  a choice of Off, Header only or Header + colours, with a line saying what applies today. Header + colours is the
  default for a new person: the colours and style of the calendar's theme for today and its top bar picture. Header
  only keeps the person's colours and changes the picture. Off changes nothing by itself. "Presets" is a gallery of
  ready themes, each card drawn as a small week in that theme's real look; the chosen one is the person's base.
  "Scene" is the top app bar background to pick by hand: Spring, Easter, Summer, Summer holidays, Fall, Halloween,
  Christmas, New Year's Eve, New Year, Winter, Sunflower field, Mordor or None. An explicit pick wins and steps the
  setting down: choosing a preset while it is Header + colours makes it Header only (the header stays seasonal);
  picking a scene turns it Off. "Fine-tuning" is where every option shows itself as a small sample before it is
  picked: theme mode, seed colour, glow (off, soft, neon), entries (solid, tinted, outline) and corners (square,
  round, pill); it always sits on top. There is no separate Mordor button; the Mordor preset does the same. A live
  preview with a real event, task list and checkbox follows every change, and so does the calendar, without a save
  button. Ready themes: Default, Neon, Spring, Easter, Summer, Summer holidays, Fall, Halloween, Christmas, New Year's
  Eve, New Year, Winter and Mordor. The calendar's theme for a day follows this priority: New Year's Eve (31 December),
  New Year (1 January), Christmas (from the 1st Advent Sunday to 30 December), Easter (a week before to six days after
  Easter Sunday), Halloween (all of October), then the season (spring from 1 March, summer from 1 June, fall from
  1 September, winter from 1 December); Summer holidays is only ever picked by hand. Christmas shows a timeline across
  the top bar: four big Advent candles, one more lit each Advent Sunday, and the tree at the end whose lights come on
  on 24 December. The choice is kept per person and holds on every device.

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

  Scenario: A new person sees the season's colours and header
    Given today is 2026-10-12
    When I open the week view for 2026-10-12
    And I open the theme menu
    Then the seasons and holidays are set to "Header + colours"
    And the theme "Halloween" is in use

  Scenario Outline: With Header + colours the colours and the header follow the calendar
    Given today is <date>
    When I open the week view for <date>
    Then the theme "<theme>" is in use
    And the top bar shows the "<scene>" scene

    Examples:
      | date       | theme          | scene       |
      | 2026-04-20 | Spring         | spring      |
      | 2026-07-10 | Summer         | summer      |
      | 2026-10-12 | Halloween      | halloween   |
      | 2026-11-10 | Fall           | fall        |
      | 2026-11-29 | Christmas      | christmas   |
      | 2026-12-20 | Christmas      | christmas   |
      | 2026-12-24 | Christmas      | christmas   |
      | 2026-12-31 | New Year's Eve | newyearseve |
      | 2027-01-01 | New Year       | newyear     |
      | 2027-01-02 | Winter         | winter      |
      | 2027-03-25 | Easter         | easter      |
      | 2027-10-12 | Halloween      | halloween   |

  Scenario Outline: The Advent timeline lights a candle each Advent Sunday and the tree lights come on at Christmas Eve
    Given today is <date>
    When I open the week view for <date>
    Then the advent timeline shows <candles> lit candles
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
    And the advent timeline shows 4 lit candles
    And the Christmas tree lights are on

  Scenario: Summer holidays can only be picked by hand
    Given today is 2026-07-10
    When I open the week view for 2026-07-10
    And I open the theme menu
    And I choose the theme "Summer holidays"
    Then the top bar shows the "summerholidays" scene
    And the theme "Summer holidays" is marked as chosen

  Scenario: New Year's Eve is dark even when I chose light
    Given today is 2026-12-31
    When I open the theme menu
    And I choose the theme mode "Light"
    Then the app uses the dark theme

  Scenario: Choosing Neon keeps the seasonal header
    Given today is 2026-12-24
    When I choose the theme "Neon"
    Then the color role "primary" has a hue within 15 degrees of "#9d4dff"
    And the top bar shows the "christmas" scene
    And the Christmas tree lights are on

  Scenario: Choosing a preset steps Header + colours down to Header only
    Given today is 2026-12-24
    When I choose the theme "Neon"
    Then the seasons and holidays are set to "Header only"

  Scenario: Choosing the Mordor scene turns seasons off
    Given today is 2026-12-24
    When I pick "Mordor" for "Scene"
    Then the top bar shows the "mordor" scene
    And the seasons and holidays are set to "Off"

  Scenario: Off keeps my preset and scene on Christmas Eve
    Given today is 2026-12-24
    When I choose the theme "Neon"
    And I set the seasons and holidays to "Off"
    Then the top bar shows no scene
    And the color role "primary" has a hue within 15 degrees of "#9d4dff"

  Scenario: Back to Header + colours makes it fully seasonal again
    Given today is 2026-12-24
    When I set the seasons and holidays to "Off"
    And I set the seasons and holidays to "Header + colours"
    Then the theme "Christmas" is in use
    And the top bar shows the "christmas" scene

  Scenario: The menu has four sections
    When I open the week view for 2026-10-12
    And I open the theme menu
    Then the theme menu sections are "Seasons & holidays", "Presets", "Scene" and "Fine-tuning"

  Scenario: The scene has its own section with one choice
    When I open the week view for 2026-10-12
    And I open the theme menu
    Then the scene choices are "Spring, Easter, Summer, Summer holidays, Fall, Halloween, Christmas, New Year's Eve, New Year, Winter, Sunflower field, Mordor, None"

  Scenario: I can pick the Halloween scene in spring
    Given today is 2026-04-12
    When I open the week view for 2026-04-12
    And I open the theme menu
    And I pick "Halloween" for "Scene"
    Then the top bar shows the "halloween" scene

  Scenario: The Mordor preset replaces the old Mordor button
    When I open the week view for 2026-10-12
    And I open the theme menu
    And I set the seasons and holidays to "Off"
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

  Scenario Outline: The settings show what follows the calendar
    Given today is 2026-12-24
    When I choose the theme "Neon"
    And I set the seasons and holidays to "<setting>"
    And I open the settings
    Then the settings show the theme "<text>"

    Examples:
      | setting          | text                    |
      | Header + colours | Christmas               |
      | Header only      | Neon · Christmas header |
      | Off              | Neon                    |

  Scenario: A fixed theme shows its own name in the settings
    Given I chose the theme "Neon"
    When I set the seasons and holidays to "Off"
    And I open the week view for 2026-10-12
    And I open the settings
    Then the settings show the theme "Neon"
