@streak @reward @id:check-in-streak
Feature: Daily check-in streak
  The first time the app is opened on a calendar day (app clock, Europe/Berlin) counts as a check-in,
  stored on the server so it syncs across devices. A small flame and the number of consecutive days are
  shown in the top app bar. A new day's check-in plays a short flicker and shows "Checked in, day N".
  Missing a day resets the count quietly; there is no shaming message, only a friendly "Welcome back".
  The flame and its message show when the person chose "Flame" as their streak (Settings › Focus & motivation; Off by
  default, feature plant-companion); the check-in counts whatever is chosen.

  Background:
    Given the calendar is empty
    And the streak is set to "Flame"

  Scenario: A new consecutive day increases the streak with a short flicker
    Given I checked in on 2026-10-09, 2026-10-10 and 2026-10-11
    And today is 2026-10-12
    When I open the app
    Then the streak shows 4
    And a "streak" effect appears and is removed within 1500 ms
    And I see the streak message "Checked in, day 4"

  Scenario: Opening the app again on the same day does not count twice
    Given I checked in on 2026-10-11 and 2026-10-12
    And today is 2026-10-12
    When I open the app
    Then the streak shows 2
    And no "streak" effect appears
    And I do not see a streak message

  Scenario: The check-in counts on every device
    Given I checked in on 2026-10-11
    And today is 2026-10-12
    When I open the app
    And I switch to another device
    And I open the app
    Then the streak shows 2
    And I do not see a streak message

  Scenario: Missing a day restarts the streak quietly
    Given I checked in on 2026-10-08, 2026-10-09 and 2026-10-10
    And today is 2026-10-12
    When I open the app
    Then the streak shows 1
    And I see the streak message "Welcome back!"
    And the page does not contain the words "lost, broke, missed, failed"

  Scenario: The very first check-in
    Given today is 2026-10-12
    When I open the app
    Then the streak shows 1
    And I see the streak message "Checked in, day 1"

  Scenario: The best streak is shown in settings
    Given I checked in on 2026-09-01, 2026-09-02, 2026-09-03, 2026-09-04 and 2026-09-05
    And today is 2026-10-12
    When I open the path "/settings"
    Then the streak shows 1
    And the best streak in settings is 5

  Scenario: Check-in respects the animation level
    Given I checked in on 2026-10-11
    And today is 2026-10-12
    And the animation level is "Off"
    When I open the app
    Then the streak shows 2
    And no "streak" effect appears
    And I see the streak message "Checked in, day 2"

  Scenario: The check-in API is idempotent per day
    Given today is 2026-10-12
    When I request "POST /api/streak/checkin"
    And I request "POST /api/streak/checkin"
    Then the response status is 200
    And the response JSON field "current" equals "1"
    And the response JSON field "checkedInToday" equals "true"
    And the response JSON field "newToday" equals "false"

  @backlog
  Scenario: The check-in counts while the streak is not shown
    Given the streak is set to "Off"
    And I checked in on 2026-10-09, 2026-10-10 and 2026-10-11
    And today is 2026-10-12
    When I open the app
    Then I do not see the streak flame
    And I do not see a streak message
    When I request "GET /api/motivation"
    Then the response JSON field "streak.current" equals "4"
