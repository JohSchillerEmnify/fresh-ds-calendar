@month @navigation @id:month-vertical
Feature: Month view that scrolls up and down
  By default the month view moves sideways: a swipe (or the arrows on desktop) replaces the month on screen with the
  next one. The setting "Month view scrolls" (owner request, 2026-10-31) offers three choices: "Sideways" (the
  default), "Up and down" and "Up and down, one month at a time". Up and down, the months are stacked in one long
  list, like the month list of Google Calendar: each month starts with a header ("November 2026"), the weekday row
  stays pinned at the top, and a month's weeks keep one fixed height (about 96 px on a phone) instead of stretching to
  the screen. "Up and down" scrolls continuously; "one month at a time" snaps so that a flick lands on the next month's
  header. The other views are not affected. The choice is a per-person preference (`monthScroll`: `sideways` |
  `vertical` | `vertical-snap`) that follows the person to every device, phone, tablet and desktop alike.
  Owner decisions, 2026-10-31:
  1. Continuous scrolling and snapping are both offered, as one setting with three values.
  2. Days of the neighbouring month in a month's first and last week are shown greyed, as in the sideways month, so
     a date appears twice in the stacked list; tapping a greyed day opens that day.
  3. The week height is fixed.
  4. The title and URL follow the month in view using replace, so there is no back step per month. Leaving the list
     by tapping a day saves the exact scroll position; going back returns to exactly that position (same month and
     the same pixel offset).
  Assumptions taken from the proposal: the month with the largest visible share is "in view"; the arrows and Today
  scroll smoothly but jump when the target is far away; the year view and month picker open the list at their month;
  only the month in view and one month before and after are built; the Labs month views and the two-row week are
  untouched.

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    And the calendar contains an event "Kino" on 2026-11-14 from 20:00 to 21:30

  Rule: The setting is in the Calendar section of the settings and follows the person

    @backlog @mobile
    Scenario: Sideways is the default
      When I open the month view for 2026-10
      Then the month view scrolls sideways
      And the month view shows only the month of 2026-10

    @backlog @mobile
    Scenario: Choosing "Up and down" in the settings
      When I open the month view for 2026-10
      And I open the settings
      Then "Sideways" is selected as the month scrolling
      When I choose "Up and down" as the month scrolling
      And I leave the settings
      Then the month view scrolls up and down
      When I open the settings
      And I choose "Up and down, one month at a time" as the month scrolling
      And I leave the settings
      Then the month view scrolls up and down one month at a time

    @backlog @mobile
    Scenario: The choice follows the person to another device
      Given the month view scrolls up and down
      When I switch to another device
      And I open the month view for 2026-10
      Then the month view scrolls up and down

    @backlog @mobile
    Scenario: The choice takes effect without reloading and keeps the month
      When I open the month view for 2026-11
      And I open the settings
      And I choose "Up and down" as the month scrolling
      And I leave the settings
      Then the month 2026-11 is the month most in view
      And the URL path is "/month/2026-11"

  Rule: The months are stacked and scroll continuously

    @backlog @mobile
    Scenario: The month and the next month are stacked under each other
      Given the month view scrolls up and down
      When I open the month view for 2026-10
      Then the month header "October 2026" is shown
      And the month 2026-11 is below the month 2026-10
      And the month header "November 2026" is shown below the month 2026-10

    @backlog @mobile
    Scenario: The weekday row stays pinned while scrolling
      Given the month view scrolls up and down
      When I open the month view for 2026-10
      And I scroll the calendar down by 600 pixels
      Then the weekday headers are "Mon, Tue, Wed, Thu, Fri, Sat, Sun"
      And the weekday row is pinned at the top of the calendar

    @backlog @mobile
    Scenario: Days of the neighbouring month are shown greyed and open their day
      Given the month view scrolls up and down
      When I open the month view for 2026-10
      Then the date 2026-10-31 appears twice in the month view
      And the day 2026-11-01 is greyed in the month 2026-10
      And the day 2026-11-01 is not greyed in the month 2026-11
      When I tap the day 2026-11-01 in the month 2026-10
      Then the URL path is "/day/2026-11-01"

    @backlog @mobile
    Scenario: Weeks keep one height and entries are shown as in the sideways month
      Given the month view scrolls up and down
      When I open the month view for 2026-10
      Then every week of the month view is 96 pixels tall
      And the month cell of 2026-10-14 shows its first entry

    @backlog @mobile
    Scenario: Sideways swiping no longer changes the month
      Given the month view scrolls up and down
      When I open the month view for 2026-10
      And I swipe left on the calendar
      Then the URL path is "/month/2026-10"
      And the page has no horizontal scroll

    @backlog @mobile
    Scenario: Scrolling down reaches the next months without a pause
      Given the month view scrolls up and down
      When I open the month view for 2026-10
      And I scroll the calendar to the month 2026-12
      Then the month header "December 2026" is shown
      And the day 2026-12-24 is in view

  Rule: One month at a time snaps to the month headers

    @backlog @mobile
    Scenario: A flick lands on the next month's header
      Given the month view scrolls up and down one month at a time
      When I open the month view for 2026-10
      And I flick the calendar up
      Then the month header "November 2026" is at the top of the calendar
      And the period title is "November 2026"
      And the URL path is "/month/2026-11"

    @backlog @mobile
    Scenario: A short drag snaps back to the month it started on
      Given the month view scrolls up and down one month at a time
      When I open the month view for 2026-10
      And I scroll the calendar down by 80 pixels
      Then the month header "October 2026" is at the top of the calendar
      And the URL path is "/month/2026-10"

    @backlog @mobile
    Scenario: A flick down goes back one month
      Given the month view scrolls up and down one month at a time
      When I open the month view for 2026-11
      And I flick the calendar down
      Then the month header "October 2026" is at the top of the calendar
      And the URL path is "/month/2026-10"

    @backlog @mobile
    Scenario: A tall month is read by scrolling inside it before it snaps
      Given the month view scrolls up and down one month at a time
      When I open the month view for 2026-11
      And I scroll the calendar down by 300 pixels
      Then the period title is "November 2026"
      And the month header "December 2026" is not at the top of the calendar

  Rule: The top bar and the URL follow the month most in view

    @backlog @mobile
    Scenario: The title and the URL change when most of the next month is in view
      Given the month view scrolls up and down
      When I open the month view for 2026-10
      And I scroll the calendar to the month 2026-11
      Then the month 2026-11 is the month most in view
      And the period title is "November 2026"
      And the URL path is "/month/2026-11"

    @backlog @mobile
    Scenario: Scrolling back up returns the title and URL to the earlier month
      Given the month view scrolls up and down
      When I open the month view for 2026-10
      And I scroll the calendar to the month 2026-11
      And I scroll the calendar to the month 2026-10
      Then the period title is "October 2026"
      And the URL path is "/month/2026-10"

    @backlog @mobile
    Scenario: Scrolling does not add browser history entries
      Given the month view scrolls up and down
      When I open the week view for 2026-10-12
      And I switch to the month view
      And I scroll the calendar to the month 2026-12
      And I go back in the browser
      Then the week view is shown
      And the URL path is "/week/2026-10-12"

    @backlog @mobile
    Scenario: A deep link opens the calendar scrolled to that month
      Given the month view scrolls up and down
      When I open the path "/month/2027-02"
      Then the month header "February 2027" is shown
      And the month 2027-02 is the month most in view
      And the period title is "February 2027"

    @backlog @mobile
    Scenario: Picking a day in the month picker scrolls to its month
      Given the month view scrolls up and down
      When I open the month view for 2026-10
      And I open the month picker
      And I pick 2026-12-24 in the month picker
      Then the month 2026-12 is the month most in view
      And the day 2026-12-24 is in view

  Rule: Today, the day view and going back

    @backlog @mobile
    Scenario: The Today button scrolls to today
      Given the month view scrolls up and down
      When I open the month view for 2027-03
      And I go to today
      Then the month 2026-10 is the month most in view
      And the day 2026-10-12 is in view
      And 2026-10-12 is highlighted as today
      And the URL path is "/month/2026-10"

    @backlog @mobile
    Scenario: The Today button shows that today is on screen while it is
      Given the month view scrolls up and down
      When I open the month view for 2026-10
      Then the Today button shows that today is on screen
      When I scroll the calendar to the month 2027-01
      Then the Today button does not show that today is on screen

    @backlog @mobile
    Scenario: Tapping a day opens the day view
      Given the month view scrolls up and down
      When I open the month view for 2026-10
      And I scroll the calendar to the month 2026-11
      And I tap the day 2026-11-14 in the month view
      Then the URL path is "/day/2026-11-14"

    @backlog @mobile
    Scenario: Going back from the day view returns to exactly the same scroll position
      Given the month view scrolls up and down
      When I open the month view for 2026-10
      And I scroll the calendar down by 700 pixels
      And I note the scroll position of the calendar
      And I tap the day 2026-11-14 in the month view
      And I go back in the browser
      Then the calendar is at the noted scroll position
      And the URL path is "/month/2026-11"

    @backlog @desktop
    Scenario: On desktop the arrows scroll by one month
      Given the month view scrolls up and down
      When I open the month view for 2026-10
      And I go to the next period
      Then the month 2026-11 is the month most in view
      And the URL path is "/month/2026-11"
      When I go to the previous period
      Then the URL path is "/month/2026-10"

  Rule: The bottom bar and the controls behave as in the other views

    @backlog @mobile
    Scenario: The bottom bar slides away while scrolling down and returns on scroll up
      Given the month view scrolls up and down
      When I open the month view for 2026-10
      Then the bottom bar is shown
      When I scroll the calendar down by 300 pixels
      Then the bottom bar is hidden
      And the create button is shown
      When I scroll the calendar up by 60 pixels
      Then the bottom bar is shown

    @backlog @mobile
    Scenario: Left-handed mode mirrors only the controls, the months still stack
      Given the month view scrolls up and down
      And left-handed mode is on
      When I open the month view for 2026-10
      Then the "create button" is on the "left" side of the screen
      And the month 2026-11 is below the month 2026-10

    @backlog @desktop
    Scenario: On desktop the mouse wheel scrolls the months
      Given the month view scrolls up and down
      When I open the month view for 2026-10
      And I scroll the mouse wheel down by 900 pixels over the calendar
      Then the month 2026-11 is the month most in view

  Rule: Only the months near the one in view are built

    @backlog @mobile
    Scenario: A long scroll never builds more than a few months
      Given the month view scrolls up and down
      When I open the month view for 2026-10
      And I scroll the calendar to the month 2027-06
      Then at most 5 months are built in the month view
      And the month 2026-10 is not built in the month view

    @backlog @mobile
    Scenario: Scrolling far back and forward keeps the entries of each month
      Given the month view scrolls up and down
      When I open the month view for 2026-10
      And I scroll the calendar to the month 2026-11
      Then the month cell of 2026-11-14 shows its first entry
      When I scroll the calendar to the month 2026-10
      Then the month cell of 2026-10-14 shows its first entry
