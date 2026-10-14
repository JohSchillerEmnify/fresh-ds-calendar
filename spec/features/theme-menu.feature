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
  round, pill), each with a slider for the value in between (glow strength, corner radius in px, entry tint in %), plus
  density (compact, comfortable, airy), the checkbox shape and fill, the check mark and the icon set (outlined, rounded,
  sharp); it always sits on top, in every Seasons & holidays mode, and choosing a preset resets it. There is no separate Mordor button; the Mordor preset does the same. A live
  preview is pinned at the top of the menu and stays in view while the person scrolls through the sections: a mini
  calendar made of the app's own components (the top bar with the current scene, a short week slice with sample events
  in different colours, a task list with ticked and open checkboxes, the + button and a few icons). It follows every
  change at once, even a slider before it is released, and so does the calendar, without a save button. It can be
  collapsed to a thin strip, and the person's choice is kept on that device. Ready themes: Default, Neon, Spring, Easter, Summer, Summer holidays, Fall, Halloween, Christmas, New Year's
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
    And the seasons and holidays are off

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

  Scenario: The live preview stays visible while I scroll the theme menu
    When I open the week view for 2026-10-12
    And I open the theme menu
    And I scroll the theme menu to the "Fine-tuning" section
    Then the live preview is pinned under the theme menu header

  Scenario: The live preview shows my change at once
    When I open the week view for 2026-10-12
    And I open the theme menu
    And I set the "Corner radius" slider to 4
    Then the preview event has a corner radius of 5 px
    When I set the "Corner radius" slider to 28
    Then the preview event has a corner radius of 16 px

  Scenario: I can collapse the live preview
    When I open the week view for 2026-10-12
    And I open the theme menu
    Then the live preview is expanded
    When I collapse the live preview
    Then the live preview is collapsed
    When I reload the page
    Then the live preview is collapsed
    When I expand the live preview
    Then the live preview is expanded

  Scenario: My theme follows me to every device
    Given "jo@example.com" may use the calendar
    And "jo@example.com" chose the theme "Neon"
    When "jo@example.com" opens the week view for 2026-10-12 on another device
    Then the event "Dentist" glows

  Scenario: A new person sees the season's colours and header
    Given today is 2026-10-12
    And the seasons and holidays follow the calendar
    When I open the week view for 2026-10-12
    And I open the theme menu
    Then the seasons and holidays are set to "Header + colours"
    And the theme "Halloween" is in use

  Scenario Outline: With Header + colours the colours and the header follow the calendar
    Given today is <date>
    And the seasons and holidays follow the calendar
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
    And the seasons and holidays follow the calendar
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
    And the seasons and holidays follow the calendar
    When I open the theme menu
    And I choose the theme mode "Light"
    Then the app uses the dark theme

  Scenario: Choosing Neon keeps the seasonal header
    Given today is 2026-12-24
    And the seasons and holidays follow the calendar
    When I choose the theme "Neon"
    Then the color role "primary" has a hue within 15 degrees of "#9d4dff"
    And the top bar shows the "christmas" scene
    And the Christmas tree lights are on

  Scenario: Choosing a preset steps Header + colours down to Header only
    Given today is 2026-12-24
    And the seasons and holidays follow the calendar
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
    And the seasons and holidays follow the calendar
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

  Scenario: The corner slider fine-tunes the corners, and a step snaps it back
    When I open the week view for 2026-10-12
    And I open the theme menu
    And I set the "Corner radius" slider to 4
    Then the "Corner radius" slider shows "4 px"
    And no option for "Corners" is pressed
    And the event "Dentist" has a corner radius of 5 px
    When I pick "Pill" for "Corners"
    Then the "Corner radius" slider shows "28 px"
    And the option "Pill" for "Corners" is pressed
    And the event "Dentist" has a corner radius of 16 px

  Scenario: A glow strength between Soft and Neon glows more than Soft and less than Neon
    When I open the week view for 2026-10-12
    And I open the theme menu
    And I pick "Soft" for "Glow"
    Then the "Glow strength" slider shows "40"
    When I set the "Glow strength" slider to 70
    Then no option for "Glow" is pressed
    And the event "Dentist" glows with a blur between 10 and 13 px
    When I set the "Glow strength" slider to 0
    Then the event "Dentist" does not glow

  Scenario: The entry tint sets how strongly tinted entries are coloured
    When I open the week view for 2026-10-12
    And I open the theme menu
    And I pick "Tinted" for "Entries"
    And I set the "Entry tint" slider to 30
    Then the "Entry tint" slider shows "30 %"
    And the entry tint is 30 %

  Scenario: Compact density makes the text smaller and Airy larger
    When I open the week view for 2026-10-12
    And I open the theme menu
    Then the app text is 14 px
    When I choose "Compact" for the "Density" setting
    Then the app text is 12.6 px
    When I choose "Airy" for the "Density" setting
    Then the app text is 15.68 px

  Scenario: The checkbox shape and the check mark show on task items
    Given the calendar contains a task list "Groceries" on 2026-10-14 with items:
      | item | done |
      | Milk | yes  |
      | Eggs | no   |
    When I open the week view for 2026-10-12
    And I open the theme menu
    And I choose "Square" for the "Checkbox shape" setting
    And I choose "Cross" for the "Check mark" setting
    And I open the day view for 2026-10-14
    And I expand the task list "Groceries"
    Then the task item checkboxes are drawn as "square" with a "cross" mark

  Scenario: Choosing a preset resets the fine-tuning
    When I open the week view for 2026-10-12
    And I open the theme menu
    And I set the "Corner radius" slider to 4
    And I set the "Glow strength" slider to 70
    And I choose the theme "Default"
    Then the "Corner radius" slider shows "6 px"
    And the "Glow strength" slider shows "0"
    And the event "Dentist" has a corner radius of 8 px

  Scenario: The icon set changes every icon of the app
    When I open the week view for 2026-10-12
    And I open the theme menu
    Then the app uses the "outlined" icon set
    When I choose "Sharp" for the "Icon set" setting
    Then the app uses the "sharp" icon set
    And every option of the "Icon set" setting shows a sample icon
    When I choose the theme "Default"
    Then the app uses the "outlined" icon set

