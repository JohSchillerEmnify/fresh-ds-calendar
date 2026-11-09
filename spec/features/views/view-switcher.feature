@view-switcher @id:view-switcher
Feature: Choosing which views the view switcher offers
  The view switcher (bottom bar, side menu, top tabs and side rail all show the same list) offers the main views
  Year, Month, Week, Day, Tasks and Clock, then the Labs views the person switched on, marked as experimental. In
  Settings › Views each main view has a switch, all on to begin with. At least one main view always stays on: the
  switch of the last one cannot be turned off. The choice is kept per person. Settings › Labs keeps the switches of the
  Labs views (Timeline, Zoom month, Horizontal, Plain clock, Strip, Bedtime runway, Now & next). The Clock is the one
  with names along its rings; the plain 24-hour clock is a Labs view called Plain clock. Every view still opens by its
  address, switched on or not (owner, 2026-11-09).

  Background:
    Given the calendar is empty
    And today is 2026-10-12

  Rule: Every main view starts on

    Scenario: A new person's switcher offers the six main views and no Labs view
      When I open the week view for 2026-10-12
      Then the view switcher shows "Year, Month, Week, Day, Tasks, Clock"

    Scenario: The Clock is a main view, not an experimental one
      When I open the week view for 2026-10-12
      And I choose "Clock" in the view switcher
      Then the URL path is "/clock-rings/2026-10-12"
      And the clock shows its "rings" variant

    Scenario: Settings › Views has one switch per main view, all on
      When I open the settings page "/settings/views"
      Then the view switches are on for "Year, Month, Week, Day, Tasks, Clock"

  Rule: A main view that is switched off leaves the switcher

    Scenario: Switching Year off removes it from the switcher
      When I open the week view for 2026-10-12
      And I switch the view "Year" off in the settings
      Then the view switcher shows "Month, Week, Day, Tasks, Clock"

    Scenario: Switching Clock off removes it, switching it on brings it back
      When I open the week view for 2026-10-12
      And I switch the view "Clock" off in the settings
      Then the view switcher shows "Year, Month, Week, Day, Tasks"
      When I switch the view "Clock" on in the settings
      Then the view switcher shows "Year, Month, Week, Day, Tasks, Clock"

    Scenario: The choice is kept when the app is opened again
      When I open the week view for 2026-10-12
      And I switch the view "Tasks" off in the settings
      And I reload the page
      Then the view switcher shows "Year, Month, Week, Day, Clock"

    Scenario: The choice belongs to the person, so another device shows it too
      Given the view "Day" is switched off for me
      When I open the week view for 2026-10-12
      Then the view switcher shows "Year, Month, Week, Tasks, Clock"

    Scenario: A view that is switched off still opens by its address
      When I open the week view for 2026-10-12
      And I switch the view "Day" off in the settings
      And I open the day view for 2026-10-12
      Then the URL path is "/day/2026-10-12"

  Rule: At least one main view stays on

    Scenario: The last view that is on cannot be switched off
      When I open the week view for 2026-10-12
      And I switch the view "Year" off in the settings
      And I switch the view "Month" off in the settings
      And I switch the view "Week" off in the settings
      And I switch the view "Day" off in the settings
      And I switch the view "Clock" off in the settings
      Then the view switcher shows "Tasks"
      When I open the settings page "/settings/views"
      Then the view switch "Tasks" is on and cannot be turned off
      And the views settings say "At least one view stays on."

    Scenario: With two views on, either can be switched off
      When I open the week view for 2026-10-12
      And I switch the view "Year" off in the settings
      And I switch the view "Month" off in the settings
      And I switch the view "Week" off in the settings
      And I switch the view "Day" off in the settings
      And I switch the view "Tasks" off in the settings
      Then the view switcher shows "Clock"
      When I switch the view "Tasks" on in the settings
      And I switch the view "Clock" off in the settings
      Then the view switcher shows "Tasks"

  Rule: Labs views follow the main views

    Scenario: Labs views come after the main views and are marked experimental
      When I open the week view for 2026-10-12
      And I turn on experimental views in the settings
      Then the view switcher shows "Year, Month, Week, Day, Tasks, Clock, Plain clock, Timeline, Zoom month, Horizontal"
      And the view switcher offers the experimental views "Plain clock, Timeline, Zoom month, Horizontal"
      And the view switcher does not mark "Clock" as experimental

    Scenario: With a main view off the Labs views still come last
      When I open the week view for 2026-10-12
      And I turn on experimental views in the settings
      And I switch the view "Year" off in the settings
      Then the view switcher shows "Month, Week, Day, Tasks, Clock, Plain clock, Timeline, Zoom month, Horizontal"

    Scenario: The Labs settings have no switch for the Clock, but one for the Plain clock
      When I open the week view for 2026-10-12
      And I turn on experimental views in the settings
      Then the Labs settings have a switch for "Plain clock"
      And the Labs settings have no switch for "Clock"

    Scenario: Switching the Clock off in the views settings does not touch the Plain clock
      When I open the week view for 2026-10-12
      And I turn on experimental views in the settings
      And I switch the view "Clock" off in the settings
      Then the view switcher shows "Year, Month, Week, Day, Tasks, Plain clock, Timeline, Zoom month, Horizontal"

    Scenario: The Clock is offered with Labs off
      When I open the week view for 2026-10-12
      Then the view switcher shows "Year, Month, Week, Day, Tasks, Clock"

  Rule: The side menu shows the same list

    @mobile
    Scenario: The side menu lists the views that are on and closes when one is chosen
      Given the view switcher on phones is set to "side menu"
      And the view "Year" is switched off for me
      When I open the week view for 2026-10-12
      And I open the side menu
      Then the side menu lists "Month, Week, Day, Tasks, Clock"
      When I choose "Tasks" in the side menu
      Then the URL path is "/tasks"
      And the side menu is closed

  Rule: The start view and the view that is open

    Scenario: The default view picker offers only the views that are on
      When I switch the view "Month" off in the settings
      Then the default view choices are "Week, Day"

    Scenario: A default view that is switched off opens the first main view that is on
      Given the default view is "Week"
      And the view "Week" is switched off for me
      And the view "Year" is switched off for me
      When I open the app
      Then the URL path is "/month/2026-10"

    Scenario: With Year on, it is the first view when the default view is off
      Given the default view is "Week"
      And the view "Week" is switched off for me
      When I open the app
      Then the URL path is "/year/2026"

    Scenario: A default view that is on still opens as before
      Given the default view is "Day"
      And the view "Year" is switched off for me
      When I open the app
      Then the URL path is "/day/2026-10-12"

    Scenario: The view that is open stays open when its switch is turned off
      When I open the week view for 2026-10-12
      And I switch the view "Week" off in the settings
      Then the URL path is "/week/2026-10-12"
      And the view switcher shows "Year, Month, Day, Tasks, Clock"
      When I choose "Day" in the view switcher
      Then the URL path is "/day/2026-10-12"

    Scenario: Moving through time is not affected by the choice
      When I open the week view for 2026-10-12
      And I switch the view "Month" off in the settings
      And I go to the next period
      Then the URL path is "/week/2026-10-19"

  Rule: The Clock keeps its address

    Scenario: The addresses of the Clock and of the Plain clock still open
      When I open the rings clock for 2026-10-14
      Then the clock shows its "rings" variant
      When I open the clock view for 2026-10-14
      Then the clock shows its "plain" variant
