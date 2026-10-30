@header-expressive @id:header-expressive
Feature: The top bar in Expressive and Compact, a month-only week title and scenes that stay whole
  Owner decision 2026-10-30 (design E, ADR 0032). The two header layouts of feature header-layout become two sizes in
  the E style, kept in the same personal setting: "Expressive" (the former two rows: the full 84 px scene, the title
  over its top, the day row below it, nothing of the scene covered) and "Compact" (the former one row, 52 px, with the
  one-row scene). Defaults: Compact on phones, Expressive on tablets and desktop. Icons in the bar are plain, with no
  see-through or glass pill over a scene; Today is the one filled button. The week title shows only the month
  ("Oct 2026") and is still tappable to jump; the day range is gone because the day row shows it. The cat and every
  large scene-defining element are fully visible in every scene, both sizes and both colour schemes (scenes may be
  readjusted to make it so); in Mordor the eye and the tower sit in the gap between the date and the icons. This
  supersedes the week title "12 – 18 Oct 2026" of features navigation and header-layout and their "Two rows" / "One row"
  wording when it is built. Approved to build: scenarios stay `@backlog` until implemented.
  The scenarios without a viewport tag run on the phone only (`@mobile`).

  Background:
    Given the calendar is empty
    And today is 2026-10-12

  Rule: The two sizes replace the two layouts

    @mobile
    Scenario: A phone starts with the Compact top bar
      When I open the day view for 2026-10-12
      Then the top bar size "Compact" is the default
      And the top bar is in one row
      And the top bar is at most 52 pixels tall

    @desktop
    Scenario: Desktop and tablets start with the Expressive top bar
      When I open the day view for 2026-10-12
      Then the top bar size "Expressive" is the default

    @mobile @backlog
    Scenario: Expressive keeps the full scene with the title over it and the day row below
      Given the top bar size is set to "Expressive"
      And the scene is "Spring"
      When I open the week view for 2026-10-12
      Then the top bar is in two rows
      And the top bar is at most 84 pixels tall
      And the top bar scene is drawn at its full 84 pixels height
      And no control covers any part of the top bar scene's large elements

    @mobile
    Scenario: The size is chosen in the settings and follows the person
      When I open the day view for 2026-10-12
      And I open the settings
      And I choose "Expressive" as the top bar size
      And I leave the settings
      Then the top bar is in two rows
      When I switch to another device
      And I open the day view for 2026-10-12
      Then the top bar is in two rows

    @mobile
    Scenario: The old header layout choice carries over
      Given the header layout is set to "One row"
      When I open the day view for 2026-10-12
      And I open the settings
      Then the top bar size "Compact" is selected

    @mobile @backlog
    Scenario Outline: Today is the only filled button and no pill shows through the scene
      Given the top bar size is set to "<size>"
      And the scene is "Halloween"
      When I open the day view for 2026-10-12
      Then the Today button is the only filled button of the top bar
      And the top bar icons have no see-through background

      Examples:
        | size       |
        | Expressive |
        | Compact    |

    @mobile
    Scenario Outline: Every top bar button keeps a 44 px hit area
      Given the top bar size is set to "<size>"
      When I open the week view for 2026-10-12
      Then the top bar's buttons are at least 44 by 44 pixels

      Examples:
        | size       |
        | Expressive |
        | Compact    |

  Rule: The week title shows only the month

    @mobile
    Scenario Outline: The week title is the month and year in both sizes
      Given the top bar size is set to "<size>"
      When I open the week view for 2026-10-12
      Then the period title is "Oct 2026"
      And the period title is not cut short

      Examples:
        | size       |
        | Expressive |
        | Compact    |

    @mobile
    Scenario: A week across two months is titled by the month of its Thursday
      When I open the week view for 2026-10-26
      Then the period title is "Oct 2026"

    @mobile
    Scenario: The week title still opens the month picker
      When I open the week view for 2026-10-12
      And I tap the period title
      Then the month picker is open

    @mobile
    Scenario: German shows the month in German
      Given the browser language is "de-DE"
      When I open the week view for 2026-10-12
      Then the period title is "Okt. 2026"

  Rule: Scenes keep every large element visible

    @mobile @visual @backlog
    Scenario Outline: The cat and every large scene element are fully visible
      Given the device prefers a <scheme> color scheme
      And the scene is "<scene>"
      And the top bar size is set to "<size>"
      When I open the day view for 2026-10-12
      Then the support cat is fully visible in the top bar scene
      And every large element of the top bar scene is fully visible
      And no control covers any part of the top bar scene's large elements
      And the "top bar" still looks like "expressive-<scene>-<size>-<scheme>"

      Examples:
        | scene           | size       | scheme |
        | Halloween       | Expressive | dark   |
        | Halloween       | Compact    | light  |
        | Sunflower field | Expressive | light  |
        | Sunflower field | Compact    | dark   |
        | Mordor          | Expressive | dark   |
        | Mordor          | Compact    | dark   |
        | Spring          | Expressive | light  |
        | Spring          | Compact    | light  |
        | Summer          | Expressive | light  |
        | Summer          | Compact    | dark   |
        | Fall            | Expressive | dark   |
        | Fall            | Compact    | light  |
        | Winter          | Expressive | light  |
        | Winter          | Compact    | dark   |
        | Easter          | Expressive | light  |
        | Easter          | Compact    | light  |
        | Summer holidays | Expressive | light  |
        | Summer holidays | Compact    | dark   |
        | Christmas       | Expressive | dark   |
        | Christmas       | Compact    | light  |
        | New Year's Eve  | Expressive | dark   |
        | New Year's Eve  | Compact    | dark   |
        | New Year        | Expressive | light  |
        | New Year        | Compact    | light  |

    @mobile @backlog
    Scenario: The Easter hare now fits in the Compact bar
      Given the scene is "Easter"
      And the top bar size is set to "Compact"
      When I open the day view for 2026-10-12
      Then the top bar scene shows the "hare"
      And no control covers any part of the top bar scene's large elements

    @mobile @backlog
    Scenario Outline: Mordor puts the eye and the tower in the gap between date and icons
      Given the scene is "Mordor"
      And the top bar size is set to "<size>"
      When I open the day view for 2026-10-12
      Then the Mordor eye and tower sit between the period title and the top bar's icons
      And no control covers any part of the top bar scene's large elements

      Examples:
        | size       |
        | Expressive |
        | Compact    |

    @mobile @backlog
    Scenario: In left-handed mode the scene is still whole
      Given the scene is "Mordor"
      And left-handed mode is on
      When I open the day view for 2026-10-12
      Then every large element of the top bar scene is fully visible
