@year @navigation
Feature: Year overview
  A brief year view: 12 mini months with a density mark per day (0 = nothing, 1 = one item,
  2 = two or three items, 3 = four or more). Tapping a month opens it. URL: /year/YYYY.

  Background:
    Given the calendar is empty
    And today is 2026-10-12

  Scenario: The year view shows twelve mini months
    When I open the year view for 2026
    Then the year view is shown
    And the URL path is "/year/2026"
    And the period title is "2026"
    And the year view shows 12 months
    And 2026-10-12 is highlighted as today
    And exactly one day is highlighted as today

  Scenario: Days are marked by how busy they are
    Given the calendar contains an event "One" on 2026-10-14 from 09:00 to 10:00
    And the calendar contains an event "Two" on 2026-10-15 from 09:00 to 10:00
    And the calendar contains an event "Three" on 2026-10-15 from 11:00 to 12:00
    And the calendar contains an empty task list "Four" on 2026-10-15
    And the calendar contains an all-day event "Five" on 2026-10-16
    And the calendar contains an event "Six" on 2026-10-16 from 09:00 to 10:00
    And the calendar contains an event "Seven" on 2026-10-16 from 11:00 to 12:00
    And the calendar contains an event "Eight" on 2026-10-16 from 13:00 to 14:00
    When I open the year view for 2026
    Then the density of 2026-10-14 in the year view is 1
    And the density of 2026-10-15 in the year view is 2
    And the density of 2026-10-16 in the year view is 3
    And the density of 2026-10-17 in the year view is 0

  Scenario: Tapping a month opens the month view
    When I open the year view for 2026
    And I click the month "March" in the year view
    Then the URL path is "/month/2026-03"

  Scenario: Previous and next move by one year
    When I open the year view for 2026
    And I go to the next period
    Then the URL path is "/year/2027"
    When I go to today
    Then the URL path is "/year/2026"

  Scenario: Switching between the year view and other views
    When I open the month view for 2026-10
    And I switch to the year view
    Then the URL path is "/year/2026"
    When I switch to the month view
    Then the URL path is "/month/2026-10"

  Scenario: An invalid year redirects to the current month
    When I open the path "/year/12"
    Then the URL path is "/month/2026-10"

  @mobile
  Scenario: The year view fits a phone and can be swiped
    Given I am using a phone
    When I open the year view for 2026
    Then the page has no horizontal scroll
    When I swipe left on the calendar
    Then the URL path is "/year/2027"
