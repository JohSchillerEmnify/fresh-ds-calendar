@nav-expressive @id:nav-expressive
Feature: A floating bottom bar in two sizes, and a side menu as the alternative
  Owner decision 2026-10-30 (design E, ADR 0032). On a phone with the view switcher at the bottom, the bar floats above
  the calendar in one of two sizes chosen in Settings: "Expressive" (64 px tall, icon and label on every item) or
  "Compact" (52 px tall, icons only, just the open view labelled, the + button beside the bar). The bar slides away
  while the person scrolls down and comes back on the first scroll up; the calendar keeps extra space at the bottom so
  the + button never hides the last hour. A new choice for where the views sit, "Side menu", has no bottom bar: a ☰
  button at the left of the top bar opens a drawer with Year, Month, Week, Day and Tasks, the calendars with colour
  checkboxes (they replace the filter button) and Settings at the bottom; the top bar then has only Today at its right,
  no filter and no settings button. The choices are personal and follow the person to every device. Defaults (owner
  2026-10-30): phones start with Compact bars (52 px bottom bar, one-row top bar); tablets and desktop start with
  Expressive. Only the phone's bottom bar and the top bar have two sizes; the desktop and tablet rail has one size.
  The scenarios without a viewport tag run on the phone only (`@mobile`).

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And the calendar contains an event "Dentist" on 2026-10-12 from 10:40 to 11:30
    And the calendar contains an event "Standup" in the calendar "Work" on 2026-10-12 from 09:00 to 09:15

  Rule: The bottom bar comes in Expressive and Compact

    @mobile
    Scenario: A phone starts with the Compact bottom bar
      When I open the week view for 2026-10-12
      Then the bottom bar size "Compact" is the default
      And the bottom bar is 52 pixels tall

    @desktop
    Scenario: The desktop rail has one size whatever the phone choice is
      Given the bottom bar size is set to "Expressive"
      When I open the week view for 2026-10-12
      Then the view switcher is in the "rail" position
      And the settings offer no rail size

    @mobile
    Scenario: Expressive is 64 px tall and labels every item
      Given the bottom bar size is set to "Expressive"
      When I open the week view for 2026-10-12
      Then the bottom bar floats above the calendar
      And the bottom bar is 64 pixels tall
      And every item of the bottom bar shows an icon and a label

    @mobile
    Scenario: Compact is 52 px tall and labels only the open view
      Given the bottom bar size is set to "Compact"
      When I open the week view for 2026-10-12
      Then the bottom bar is 52 pixels tall
      And only the open view of the bottom bar shows a label
      And the create button is beside the bottom bar

    @mobile
    Scenario: In Compact the label moves with the open view
      Given the bottom bar size is set to "Compact"
      When I open the week view for 2026-10-12
      And I switch to the month view
      Then only the open view of the bottom bar shows a label

    @mobile
    Scenario: The size is chosen in the settings and follows the person
      When I open the week view for 2026-10-12
      And I open the settings
      And I choose "Compact" as the bottom bar size
      And I leave the settings
      Then the bottom bar is 52 pixels tall
      When I switch to another device
      And I open the week view for 2026-10-12
      Then the bottom bar is 52 pixels tall

    @mobile
    Scenario Outline: Every bottom bar item keeps a 44 px hit area
      Given the bottom bar size is set to "<size>"
      When I open the week view for 2026-10-12
      Then the navigation, view switcher and create buttons are at least 44 by 44 pixels

      Examples:
        | size       |
        | Expressive |
        | Compact    |

    @mobile
    Scenario: Left-handed mode mirrors the Compact bar and its + button
      Given the bottom bar size is set to "Compact"
      And left-handed mode is on
      When I open the week view for 2026-10-12
      Then the "create button" is on the "left" side of the screen

  Rule: The bottom bar slides away while scrolling down and returns on scroll up

    @mobile
    Scenario Outline: Scrolling down hides the bar and scrolling up brings it back
      Given the bottom bar size is set to "<size>"
      When I open the day view for 2026-10-12
      And I scroll the calendar down by 300 pixels
      Then the bottom bar is hidden
      And the create button is shown
      When I scroll the calendar up by 60 pixels
      Then the bottom bar is shown

      Examples:
        | size       |
        | Expressive |
        | Compact    |

    @mobile
    Scenario: The bar stays while the calendar is at the top
      When I open the day view for 2026-10-12
      Then the bottom bar is shown

    @mobile
    Scenario: The last hour of the day can be scrolled clear of the + button
      When I open the day view for 2026-10-12
      And I scroll the time grid to the end of the day
      Then the add button covers no hour of the time grid

  Rule: On a phone the calendar continues underneath the floating bar

    @mobile
    Scenario Outline: The calendar is drawn behind the bar, down to the screen edge
      Given today is 2026-11-02
      And the calendar contains a task list "Laundry" on 2026-10-25 with items:
        | item   | done |
        | Washer | no   |
      When I open the <view> view for <period>
      Then the calendar continues behind the bottom bar

      Examples:
        | view  | period     |
        | week  | 2026-11-02 |
        | day   | 2026-10-25 |

    @mobile
    Scenario: The calendar is drawn behind the bar when no task list is open
      Given the calendar is empty
      When I open the week view for 2026-10-12
      Then the calendar continues behind the bottom bar

  Rule: The room of a hidden bar is given back, and on wide screens the bar floats with its room reserved

    @mobile
    Scenario Outline: A hidden bar leaves no empty strip at the bottom
      Given the bottom bar size is set to "<size>"
      When I open the day view for 2026-10-12
      And I scroll the calendar down by 300 pixels
      Then the bottom bar is hidden
      And nothing is reserved at the bottom of the screen

      Examples:
        | size       |
        | Expressive |
        | Compact    |

    @desktop @tablet
    Scenario: On wide screens the bar floats 16 px from the edges and never covers the calendar
      Given the view switcher on desktop and tablets is set to "bottom"
      When I open the week view for 2026-10-12
      Then the bottom bar floats 16 pixels from the edges of the screen
      And the calendar ends above the bottom bar

  Rule: The side menu replaces the bottom bar

    @mobile
    Scenario: Choosing the side menu removes the bottom bar and shows the ☰ button
      Given the view switcher on phones is set to "side menu"
      When I open the week view for 2026-10-12
      Then there is no bottom bar
      And the menu button is on the "left" side of the top bar

    @mobile
    Scenario: The drawer lists the views and puts Settings at the bottom
      Given the view switcher on phones is set to "side menu"
      When I open the week view for 2026-10-12
      And I open the side menu
      Then the side menu lists "Year, Month, Week, Day, Tasks"
      And the side menu has the "Settings" entry at its bottom

    @mobile
    Scenario: Choosing a view in the drawer switches the view and closes the drawer
      Given the view switcher on phones is set to "side menu"
      When I open the month view for 2026-10
      And I open the side menu
      And I choose "Week" in the side menu
      Then the URL path is "/week/2026-10-12"
      And the side menu is closed

    @mobile
    Scenario: The drawer lists the calendars with colour checkboxes
      Given the view switcher on phones is set to "side menu"
      When I open the week view for 2026-10-12
      And I open the side menu
      Then the side menu shows the calendars "Personal, Work" with a colour checkbox each

    @mobile
    Scenario: Unticking a calendar in the drawer hides its events
      Given the view switcher on phones is set to "side menu"
      When I open the week view for 2026-10-12
      And I open the side menu
      And I untick the calendar "Work" in the side menu
      And I close the side menu
      Then I do not see the event "Standup"
      And I see the event "Dentist" on 2026-10-12

    @mobile
    Scenario: With the side menu the top bar has only Today at its right
      Given the view switcher on phones is set to "side menu"
      When I open the week view for 2026-10-12
      Then the top bar has no filter button and no settings button
      And the "Today button" is on the "right" side of the screen

    @mobile
    Scenario: In left-handed mode the ☰ button and the drawer move to the right
      Given the view switcher on phones is set to "side menu"
      And left-handed mode is on
      When I open the week view for 2026-10-12
      Then the menu button is on the "right" side of the top bar
      And the "Today button" is on the "left" side of the screen

    @mobile
    Scenario: The choice is made in the settings and follows the person
      When I open the week view for 2026-10-12
      And I open the settings
      And I choose "Side menu" as the view switcher position on phones
      And I leave the settings
      Then there is no bottom bar
      When I switch to another device
      And I open the week view for 2026-10-12
      Then there is no bottom bar
