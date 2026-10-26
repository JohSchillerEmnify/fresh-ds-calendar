@header-layout @id:header-layout
Feature: A smaller header: two rows or one row
  The top bar took 96 px on a phone and the day view showed the date twice (owner, 2026-10-26). The person chooses
  one of two header layouts in Settings › Calendar ("Header layout"): "Two rows" (the default) keeps the full date
  ("Monday, 12 October 2026") in an 18 px title row and puts ‹ Today › with the streak flame, plant and sync icon in a
  compact second row, 84 px in all; "One row" puts the short date ("Mon, 12 Oct"), ‹, a Today icon and › into one
  52 px row with the streak flame, plant, sync, filter and settings at its right. Only the day view's title is
  shortened; the week, month and year titles stay as they are. The visuals may be smaller, but every control keeps a
  hit area of at least 44 by 44 px. The choice is a personal setting like the view switcher position: kept per
  person (so it follows them to every device), not part of the theme, so choosing a theme, preset or scene keeps it
  and a theme file never carries it. It applies to phones (narrower than 768 px); desktop and tablets keep their one
  row with the full date as built (open point, see REQUIREMENTS). Left-handed mode mirrors the one row as it mirrors
  the two rows: settings and the other icons at the left, the date, then ‹ Today › at the right.
  Every scene is re-arranged for each layout, light and dark: every part keeps its as-built size (the 96 px scene box
  sits on the bar's bottom edge, sky parts move down, taller props are cut only at the bar's bottom edge), and no
  character (cat, hare, ghost) is ever under or behind a control; where a character cannot fit at a width it is left
  out there (the Easter hare in one row on a 390 px phone). Calm mode and reduced motion work as before.
  The scenarios without a viewport tag run on the phone only (`@mobile`).

  Background:
    Given the calendar is empty
    And today is 2026-10-12

  Rule: Two rows is the default, one row is the person's choice

    @mobile @backlog
    Scenario: A phone shows the two-row header by default
      When I open the day view for 2026-10-12
      Then the top bar is in two rows
      And the top bar is at most 84 pixels tall
      And the period title is "Monday, 12 October 2026"
      And the period title is not cut short
      And the period title's font size is 18 pixels

    @mobile @backlog
    Scenario: The one-row header puts the short date, the arrows and Today in one row
      Given the header layout is set to "One row"
      When I open the day view for 2026-10-12
      Then the top bar is in one row
      And the top bar is at most 52 pixels tall
      And the period title is "Mon, 12 Oct"
      And the period title is not cut short
      And the period title's font size is 18 pixels
      And the Today button is an icon with the label "Today"

    @mobile @backlog
    Scenario Outline: Only the day view's title is shortened in one row
      Given the header layout is set to "One row"
      When I open the path "<path>"
      Then the period title is "<title>"
      And the period title is not cut short

      Examples:
        | path             | title            |
        | /day/2026-10-14  | Wed, 14 Oct      |
        | /week/2026-10-12 | 12 – 18 Oct 2026 |
        | /month/2026-10   | October 2026     |
        | /year/2026       | 2026             |

    @mobile @backlog
    Scenario: German shows the short date in German in one row
      Given the browser language is "de-DE"
      And the header layout is set to "One row"
      When I open the day view for 2026-10-13
      Then the period title is "Di., 13. Okt."

    # Depends on open point Q1 (REQUIREMENTS): at 390 px one row has no room for eight 44 px wide hit areas.
    @mobile @backlog
    Scenario Outline: Every control in the header keeps a 44 px hit area
      Given the header layout is set to "<layout>"
      When I open the week view for 2026-10-12
      Then the navigation, view switcher and create buttons are at least 44 by 44 pixels
      And the top bar's buttons are at least 44 by 44 pixels

      Examples:
        | layout   |
        | Two rows |
        | One row  |

    @mobile @backlog
    Scenario: The choice is made in the settings and follows the person
      When I open the day view for 2026-10-12
      And I open the settings
      Then the header layout "Two rows" is selected
      When I choose "One row" as the header layout
      And I leave the settings
      Then the top bar is in one row
      When I switch to another device
      And I open the day view for 2026-10-12
      Then the top bar is in one row

    @mobile @backlog
    Scenario: Choosing a theme keeps the header layout
      Given the header layout is set to "One row"
      When I open the theme menu
      And I choose the theme "Spring"
      And I open the day view for 2026-10-12
      Then the top bar is in one row

    @backlog
    Scenario: A theme file does not carry the header layout
      Given the header layout is set to "One row"
      When I open the theme menu
      And I export the theme "Spring"
      Then the theme file "Spring" is downloaded
      And the downloaded theme file has no header layout

    @mobile @backlog
    Scenario: In left-handed mode the one row is mirrored
      Given the header layout is set to "One row"
      And left-handed mode is on
      When I open the day view for 2026-10-12
      Then the top bar is in one row
      And the "settings button" is on the "left" side of the screen
      And the "Today button" is on the "right" side of the screen

    # Open point (REQUIREMENTS Q4): the recommendation is that the choice is for phones only.
    @desktop @backlog
    Scenario: Desktop keeps its one row with the full date whatever the phone layout is
      Given the header layout is set to "One row"
      When I open the day view for 2026-10-12
      Then the top bar is in one row
      And the period title is "Monday, 12 October 2026"
      And the Today button shows the word "Today"

  Rule: The date is shown once: the day view has no day header

    @backlog
    Scenario: The day view shows the date only in the title
      When I open the day view for 2026-10-14
      Then the day view shows no day header
      And the period title is "Wednesday, 14 October 2026"

    @backlog
    Scenario: The week view keeps its day headers
      When I open the week view for 2026-10-12
      Then the week view shows 7 day headers

  Rule: The all-day row is there only when it has something to show

    @backlog
    Scenario: A day without all-day entries or task lists has no all-day row
      Given the calendar contains an event "Dentist" on 2026-10-12 from 10:40 to 11:30
      When I open the day view for 2026-10-12
      Then the all-day row is not shown

    @backlog
    Scenario: A task list without a time brings the all-day row back with its switch
      Given the calendar contains a task list "Groceries" on 2026-10-12 with items:
        | Milk |
      When I open the day view for 2026-10-12
      Then the all-day row is shown
      And the task list "Groceries" is shown in the all-day area on 2026-10-12
      And the tasks section switch is shown

    @backlog
    Scenario: An all-day event brings the all-day row back
      Given the calendar contains an all-day event "Trip" on 2026-10-12
      When I open the day view for 2026-10-12
      Then the all-day row is shown
      And I see the all-day event "Trip" on 2026-10-12

    @backlog
    Scenario Outline: In the week view one day with something keeps the all-day row for the whole week
      Given the calendar contains <entry>
      When I open the week view for 2026-10-12
      Then the all-day row is <shown>

      Examples:
        | entry                                                     | shown     |
        | an all-day event "Trip" on 2026-10-17                     | shown     |
        | an event "Dentist" on 2026-10-14 from 10:40 to 11:30      | not shown |

    @backlog
    Scenario: While something is dragged the all-day row appears, so a task list can still lose its time there
      Given the calendar contains a task list "Packing" on 2026-10-12 at 18:00 with items:
        | Socks |
      When I open the day view for 2026-10-12
      Then the all-day row is not shown
      When I pick up the task list "Packing"
      Then the all-day row is shown
      When I drop the dragged item in the all-day row on 2026-10-12
      Then the task list "Packing" is shown in the all-day area on 2026-10-12

    @backlog
    Scenario: The all-day row goes again when a drag ends without a drop there
      Given the calendar contains a task list "Packing" on 2026-10-12 at 18:00 with items:
        | Socks |
      When I open the day view for 2026-10-12
      And I pick up the task list "Packing"
      And I drop the dragged item on 2026-10-12 at 19:00
      Then the all-day row is not shown

  Rule: Every scene looks right in both layouts

    @mobile @backlog
    Scenario Outline: No scene character sits under a control and every part keeps its size
      Given the device prefers a <scheme> color scheme
      And the scene is "<scene>"
      And the header layout is set to "<layout>"
      When I open the day view for 2026-10-12
      Then no character of the top bar scene is under a control
      And the top bar scene's parts are drawn at their full size
      And the "top bar" still looks like "scene-<scene>-<layout>-<scheme>"

      Examples:
        | scene           | layout   | scheme |
        | Halloween       | Two rows | dark   |
        | Halloween       | One row  | dark   |
        | Halloween       | Two rows | light  |
        | Halloween       | One row  | light  |
        | Sunflower field | Two rows | dark   |
        | Sunflower field | One row  | dark   |
        | Sunflower field | Two rows | light  |
        | Sunflower field | One row  | light  |
        | Mordor          | Two rows | dark   |
        | Mordor          | One row  | dark   |
        | Mordor          | Two rows | light  |
        | Mordor          | One row  | light  |
        | Spring          | Two rows | dark   |
        | Spring          | One row  | dark   |
        | Spring          | Two rows | light  |
        | Spring          | One row  | light  |
        | Summer          | Two rows | dark   |
        | Summer          | One row  | dark   |
        | Summer          | Two rows | light  |
        | Summer          | One row  | light  |
        | Fall            | Two rows | dark   |
        | Fall            | One row  | dark   |
        | Fall            | Two rows | light  |
        | Fall            | One row  | light  |
        | Winter          | Two rows | dark   |
        | Winter          | One row  | dark   |
        | Winter          | Two rows | light  |
        | Winter          | One row  | light  |
        | Easter          | Two rows | dark   |
        | Easter          | One row  | dark   |
        | Easter          | Two rows | light  |
        | Easter          | One row  | light  |
        | Summer holidays | Two rows | dark   |
        | Summer holidays | One row  | dark   |
        | Summer holidays | Two rows | light  |
        | Summer holidays | One row  | light  |
        | Christmas       | Two rows | dark   |
        | Christmas       | One row  | dark   |
        | Christmas       | Two rows | light  |
        | Christmas       | One row  | light  |
        | New Year's Eve  | Two rows | dark   |
        | New Year's Eve  | One row  | dark   |
        | New Year's Eve  | Two rows | light  |
        | New Year's Eve  | One row  | light  |
        | New Year        | Two rows | dark   |
        | New Year        | One row  | dark   |
        | New Year        | Two rows | light  |
        | New Year        | One row  | light  |

    @mobile @backlog
    Scenario: The Easter hare is left out where it cannot sit clear of the controls
      Given the scene is "Easter"
      And the header layout is set to "One row"
      When I open the day view for 2026-10-12
      Then the top bar scene does not show the "hare"
      And no character of the top bar scene is under a control

    @mobile @backlog
    Scenario: With reduced motion the one-row scene is still from the start
      Given the device prefers reduced motion
      And the seasons and holidays follow the calendar
      And the header layout is set to "One row"
      And the time is 2026-10-31 18:00 and the clock is running
      When I open the week view for 2026-10-31
      Then the top bar shows the "halloween" scene
      And the top bar scene is still
