@header-layout @id:header-layout
Feature: A smaller header: two rows or one row
  The top bar took 96 px on a phone and the day view showed the date twice (owner, 2026-10-26). The person chooses
  one of two header layouts in Settings › Calendar ("Header layout"): "Two rows" (now called Expressive; the default only off phones, see feature header-expressive) keeps the full date
  ("Monday, 12 October 2026") in an 18 px title row and puts Today with the streak and the sync icon in a compact
  second row, 84 px in all; "One row" puts the short date ("Mon, 12 Oct") and a Today icon into one 52 px row with the
  streak, sync, filter and settings at its right. Touch screens have no ‹ › arrows: a swipe on the calendar moves to the
  next or previous period (owner, 2026-10-26; feature navigation); desktop with a mouse keeps them. Only the day view's title is shortened; the week, month and
  year titles stay as they are. The visuals may be smaller, but every button keeps a hit area of at least 44 by 44 px
  (in two rows Today's reaches invisibly below the bar); the one exception is the plant in one row, whose tap area is 44 px tall and 32 px wide so the row stays one row. The
  streak flame and the sync icon are not buttons and need no tap area. The choice is a personal setting like the view
  switcher position: kept per person (so it follows them to every device), not part of the theme, so choosing a theme,
  preset or scene keeps it and a theme file never carries it. It applies to phones (narrower than 768 px); desktop and
  tablets keep their one row with the full date. Left-handed mode mirrors both layouts: settings and the other icons at
  the left, the date at the right. It is an exact mirror of the right-handed bar's boxes (owner, 2026-10-26), so a scene
  can simply be flipped: the title's text sits at the outer edge and the widgets come in reverse order.
  The Today button is the today mark (it replaces the today circle of the old "Mon 12" day header): filled while today
  is in the shown period, outlined on a solid background (the scene never shows through) when it is not; the same in
  both layouts and on desktop. The day view has no day header at any width, so on desktop its grid starts 36 px higher.
  The sync icon shows only while syncing fails, unless the person turns on "Sync indicator" in Settings › Calendar
  (off by default); then it shows all the time as before.
  Every scene is re-arranged for each layout, light and dark: every part keeps its as-built size (the 96 px scene box
  sits on the bar's bottom edge, sky parts move down, taller props are cut only at the bar's bottom edge), and no
  character (cat, hare, ghost) is ever under or behind a control; where a character cannot fit at a width it is left
  out there (the Easter hare in one row on a 390 px phone). Calm mode and reduced motion work as before.
  The scenarios without a viewport tag run on the phone only (`@mobile`).

  Background:
    Given the calendar is empty
    And today is 2026-10-12

  Rule: Two rows is the person's choice, one row the phone's default (feature header-expressive: Expressive and Compact)

    @mobile
    Scenario: The two-row header keeps the full scene below one row of controls
      Given the header layout is set to "Two rows"
      When I open the day view for 2026-10-12
      Then the top bar is in two rows
      And the top bar is at most 84 pixels tall
      And the period title is "Mon, 12 Oct"
      And the period title is not cut short
      And the period title's font size is 18 pixels

    @mobile
    Scenario: The one-row header puts the short date and Today in one row
      Given the header layout is set to "One row"
      When I open the day view for 2026-10-12
      Then the top bar is in one row
      And the top bar is at most 52 pixels tall
      And the period title is "Mon, 12 Oct"
      And the period title is not cut short
      And the period title's font size is 18 pixels
      And the Today button is an icon with the label "Today"

    @mobile
    Scenario Outline: Only the day view's title is shortened in one row
      Given the header layout is set to "One row"
      When I open the path "<path>"
      Then the period title is "<title>"
      And the period title is not cut short

      Examples:
        | path             | title            |
        | /day/2026-10-14  | Wed, 14 Oct      |
        | /week/2026-10-12 | Oct 2026         |
        | /month/2026-10   | October 2026     |
        | /year/2026       | 2026             |

    @mobile
    Scenario: German shows the short date in German in one row
      Given the browser language is "de-DE"
      And the header layout is set to "One row"
      When I open the day view for 2026-10-13
      Then the period title is "Di., 13. Okt."

    @mobile
    Scenario Outline: Every button in the header keeps a 44 px hit area
      Given the header layout is set to "<layout>"
      And the streak is set to "<streak>"
      When I open the week view for 2026-10-12
      Then the navigation, view switcher and create buttons are at least 44 by 44 pixels
      And the top bar's buttons are at least 44 by 44 pixels

      Examples:
        | layout   | streak |
        | Two rows | Off    |
        | One row  | Off    |
        | Two rows | Plant  |

    @mobile
    Scenario: The choice is made in the settings and follows the person
      When I open the day view for 2026-10-12
      And I open the settings
      Then the top bar size "Compact" is selected
      When I choose "Expressive" as the top bar size
      And I leave the settings
      Then the top bar is in two rows
      When I switch to another device
      And I open the day view for 2026-10-12
      Then the top bar is in two rows

    # owner, 2026-10-26: with a streak on the row stays one row; only the plant is a button, its tap area 32 px wide
    @mobile
    Scenario: With the plant on, the one row keeps its date and gives the plant a narrower tap area
      Given the streak is set to "Plant"
      And the header layout is set to "One row"
      When I open the day view for 2026-10-12
      Then the top bar is in one row
      And the top bar is at most 52 pixels tall
      And I see the plant
      And the period title is "Mon, 12 Oct"
      And the period title is not cut short
      And the plant's tap area is at least 32 by 44 pixels
      And the top bar's buttons other than the plant are at least 44 by 44 pixels

    @mobile
    Scenario: With the flame on, the one row keeps its date
      Given the streak is set to "Flame"
      And the header layout is set to "One row"
      When I open the day view for 2026-10-12
      Then the top bar is in one row
      And I see the streak flame
      And the period title is "Mon, 12 Oct"
      And the period title is not cut short
      And the top bar's buttons are at least 44 by 44 pixels

    # owner, 2026-10-26: without the arrows the date fits next to a streak and a sync problem; the chevron stays
    @mobile
    Scenario: In one row a streak and a sync problem leave the date in full
      Given the streak is set to "Plant"
      And the header layout is set to "One row"
      When I open the day view for 2026-10-12
      And Google becomes unavailable
      And the app regains focus
      Then the sync icon shows a problem
      And the period title is "Mon, 12 Oct"
      And the period title is not cut short
      And the period title's chevron is shown
      And the top bar is in one row

    @mobile
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

    @mobile
    Scenario: In left-handed mode the one row is mirrored
      Given the header layout is set to "One row"
      And left-handed mode is on
      When I open the day view for 2026-10-12
      Then the top bar is in one row
      And the "settings button" is on the "left" side of the screen
      And the "period title" is on the "right" side of the screen

    # owner, 2026-10-26: left-handed is an exact mirror of the right-handed boxes, so the season scene can be flipped
    @mobile
    Scenario Outline: In left-handed mode the top bar is the mirror image of the right-handed one
      Given the streak is set to "Flame"
      And the sync indicator is on
      And the header layout is set to "<layout>"
      When I open the day view for 2026-10-12
      And I note where the top bar's controls are
      And I turn on left-handed mode
      Then every control of the top bar is at the mirror image of where it was, within 1 pixel
      And the period title's text is aligned to the outer edge
      And the top bar's widgets are in reverse order

      Examples:
        | layout   |
        | Two rows |
        | One row  |

    @desktop
    Scenario: Desktop keeps its one row with the full date whatever the phone layout is
      Given the header layout is set to "One row"
      When I open the day view for 2026-10-12
      Then the top bar is in one row
      And the period title is "Monday, 12 October 2026"
      And the Today button shows the word "Today"

  Rule: The date is shown once: the day view has no day header

    @mobile
    Scenario: The day view shows the date only in the title
      When I open the day view for 2026-10-14
      Then the day view shows no day header
      And the period title is "Wed, 14 Oct"

    # owner, 2026-10-26: desktop drops the day header too; its top bar keeps one row with the full date
    @desktop
    Scenario: On desktop the day view has no day header either
      When I open the day view for 2026-10-14
      Then the day view shows no day header
      And the top bar is in one row
      And the period title is "Wednesday, 14 October 2026"

    # owner, 2026-10-26: the Today button is the today mark, the same in both layouts
    @mobile
    Scenario Outline: The Today button marks today in both layouts
      Given the header layout is set to "<layout>"
      When I open the day view for <day>
      Then the Today button <marks> that today is on screen

      Examples:
        | layout   | day        | marks         |
        | Two rows | 2026-10-12 | shows         |
        | Two rows | 2026-10-13 | does not show |
        | One row  | 2026-10-12 | shows         |
        | One row  | 2026-10-13 | does not show |

    Scenario: The week view keeps its day headers
      When I open the week view for 2026-10-12
      Then the week view shows 7 day headers

  Rule: The all-day row is there only when it has something to show
    Its switch (titles / expanded task lists) shows only when task lists are in the row: with nothing to switch there
    is no switch (owner, 2026-10-26).

    Scenario: A day without all-day entries or task lists has no all-day row
      Given the calendar contains an event "Dentist" on 2026-10-12 from 10:40 to 11:30
      When I open the day view for 2026-10-12
      Then the all-day row is not shown

    Scenario: A task list without a time brings the all-day row back with its switch
      Given the calendar contains a task list "Groceries" on 2026-10-12 with items:
        | Milk |
      When I open the day view for 2026-10-12
      Then the all-day row is shown
      And the task list "Groceries" is shown in the all-day area on 2026-10-12
      And the tasks section switch is shown

    Scenario: An all-day event brings the all-day row back
      Given the calendar contains an all-day event "Trip" on 2026-10-12
      When I open the day view for 2026-10-12
      Then the all-day row is shown
      And I see the all-day event "Trip" on 2026-10-12
      And the tasks section switch is not shown

    Scenario Outline: In the week view one day with something keeps the all-day row for the whole week
      Given the calendar contains <entry>
      When I open the week view for 2026-10-12
      Then the all-day row is <shown>

      Examples:
        | entry                                                     | shown     |
        | an all-day event "Trip" on 2026-10-17                     | shown     |
        | an event "Dentist" on 2026-10-14 from 10:40 to 11:30      | not shown |

    Scenario: While something is dragged the all-day row appears, so a task list can still lose its time there
      Given the calendar contains a task list "Packing" on 2026-10-12 at 18:00 with items:
        | Socks |
      When I open the day view for 2026-10-12
      Then the all-day row is not shown
      When I pick up the task list "Packing"
      Then the all-day row is shown
      When I drop the dragged item in the all-day row on 2026-10-12
      Then the task list "Packing" is shown in the all-day area on 2026-10-12

    # a timed event cannot become all-day by a drop, so its drag brings no row (it would hide the drop time it aims by)
    @desktop
    Scenario: Dragging a timed event does not bring the all-day row
      Given the calendar contains an event "Dentist" on 2026-10-12 from 10:40 to 11:30
      When I open the day view for 2026-10-12
      And I pick up the event "Dentist" and move it down by 1 hours
      Then the all-day row is not shown

    Scenario: The all-day row goes again when a drag ends without a drop there
      Given the calendar contains a task list "Packing" on 2026-10-12 at 18:00 with items:
        | Socks |
      When I open the day view for 2026-10-12
      And I pick up the task list "Packing"
      And I drop the dragged item on 2026-10-12 at 19:00
      Then the all-day row is not shown

  Rule: The sync icon shows only when syncing fails, unless the person turns it on

    Scenario: By default the sync icon stays out of the way while all is well
      When I open the week view for 2026-10-12
      Then I do not see the sync icon

    Scenario: A sync problem always shows its icon
      When I open the week view for 2026-10-12
      And Google becomes unavailable
      And the app regains focus
      Then I see the sync error banner
      And the sync icon shows a problem
      When Google becomes available again
      And I retry the sync
      Then I do not see the sync icon

    Scenario: With the sync indicator on the sync icon shows all the time
      When I open the settings
      Then the "Sync indicator" switch in the settings is off
      When I turn on "Sync indicator" in the settings
      And I open the week view for 2026-10-12
      Then I see the sync icon

  Rule: Scenes keep their look in both layouts (feature header-expressive: the cat and every large element stay whole)

    @mobile
    Scenario: With reduced motion the one-row scene is still from the start
      Given the device prefers reduced motion
      And the seasons and holidays follow the calendar
      And the header layout is set to "One row"
      And the time is 2026-10-31 18:00 and the clock is running
      When I open the week view for 2026-10-31
      Then the top bar shows the "halloween" scene
      And the top bar scene is still
