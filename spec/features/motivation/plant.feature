@plant @reward @id:plant-companion
Feature: Plant companion
  A small plant in the top app bar grows when the user does things: daily check-in +10 points,
  creating an event or task list +5, ticking an item +2 (each item counts once per day), at most
  30 points per day. Growth never goes down. Stages: Seed (0), Sprout (20), Small plant (60),
  Leafy (140), Flowering (280). Without activity it rests: 0–1 days since last watering = happy,
  2 = thirsty, 3 = dry, 4 or more = droopy. It never dies and perks up as soon as it is watered.
  Settings "Focus & motivation" has one "Streak" choice: Off, Flame or Plant (owner, 2026-10-26; it replaced the two
  switches "Streak flame" and "Plant"). It is a personal setting, Off by default, and Off for everyone after the
  change, whatever the two switches were before. It only decides what the top bar shows: the check-ins and the plant's
  points are counted whatever is chosen. The plant is the widget in the top bar and is independent of the scene behind
  it (the sunflower field is a scene).

  Background:
    Given the calendar is empty
    And today is 2026-10-12

  Scenario: Daily actions water the plant and it grows to the next stage
    Given the streak is set to "Plant"
    And the calendar contains a task list "Chores" on 2026-10-12 with items:
      | item  | done |
      | Dust  | no   |
      | Sweep | no   |
      | Mop   | no   |
    When I open the day view for 2026-10-12
    Then I see the plant
    And the plant is at the stage "Seed"
    And the plant looks "happy"
    When I expand the task list "Chores"
    And I tick the item "Dust"
    Then a "water" effect appears and is removed within 1000 ms
    When I tick the item "Sweep"
    And I tick the item "Mop"
    And I collapse the task list
    And I start creating a task list
    And I fill in the task list form with:
      | title | Ideas      |
      | date  | 2026-10-12 |
    And I save the task list
    Then a "grow" effect appears and is removed within 1500 ms
    And the plant is at the stage "Sprout"
    When I request "GET /api/motivation"
    Then the response JSON field "plant.growth" equals "21"
    And the response JSON field "plant.todayPoints" equals "21"

  Scenario: Watering has a daily cap and repeated ticks do not count twice
    Given the calendar contains a task list "Chores" on 2026-10-12 with items:
      | item  | done |
      | Dust  | no   |
      | Sweep | no   |
      | Mop   | no   |
    When I open the day view for 2026-10-12
    And I expand the task list "Chores"
    And I tick the item "Dust"
    And I untick the item "Dust"
    And I tick the item "Dust"
    And I request "GET /api/motivation"
    Then the response JSON field "plant.growth" equals "12"
    When I tick the item "Sweep"
    And I tick the item "Mop"
    And I collapse the task list
    And I start creating a task list
    And I fill in the task list form with:
      | title | One        |
      | date  | 2026-10-12 |
    And I save the task list
    And I start creating a task list
    And I fill in the task list form with:
      | title | Two        |
      | date  | 2026-10-12 |
    And I save the task list
    And I start creating a task list
    And I fill in the task list form with:
      | title | Three      |
      | date  | 2026-10-12 |
    And I save the task list
    And I request "GET /api/motivation"
    Then the response JSON field "plant.growth" equals "30"
    And the response JSON field "plant.todayPoints" equals "30"

  Scenario Outline: Without activity the plant rests gently but never dies
    Given the plant has 70 growth points and was last watered on <last>
    When I request "GET /api/motivation"
    Then the response JSON field "plant.mood" equals "<mood>"
    And the response JSON field "plant.vitality" equals "<vitality>"
    And the response JSON field "plant.stage" equals "Small plant"

    Examples:
      | last       | mood    | vitality |
      | 2026-10-11 | happy   | 100      |
      | 2026-10-10 | thirsty | 75       |
      | 2026-10-09 | dry     | 50       |
      | 2026-10-08 | droopy  | 25       |
      | 2026-01-01 | droopy  | 25       |

  Scenario: A resting plant perks up when the app is opened
    Given the streak is set to "Plant"
    And the plant has 70 growth points and was last watered on 2026-10-01
    When I open the app
    Then a "perk-up" effect appears and is removed within 1500 ms
    And the plant looks "happy"
    And the plant is at the stage "Small plant"

  Scenario Outline: The plant card shows the plant larger with a friendly line
    Given the streak is set to "Plant"
    And the plant has <growth> growth points and was last watered on 2026-10-12
    When I open the app
    And I open the plant card
    Then the plant card shows the stage "<stage>"
    And the plant card shows "Your plant is happy"

    Examples:
      | growth | stage       |
      | 0      | Seed        |
      | 20     | Sprout      |
      | 60     | Small plant |
      | 140    | Leafy       |
      | 280    | Flowering   |

  Scenario: No guilt wording anywhere
    Given the streak is set to "Plant"
    And the plant has 70 growth points and was last watered on 2026-09-01
    When I request "GET /api/motivation"
    Then the response JSON field "plant.message" equals "Your plant is resting. Anything you do will perk it up."
    When I open the app
    And I open the plant card
    Then the page does not contain the words "dead, died, dying, lost, failed, neglected"

  # owner, 2026-10-26: one choice replaces the two switches
  Scenario Outline: The streak choice decides what the top bar shows
    When I open the settings
    And I choose "<streak>" for the streak
    And I open the app
    Then I <flame> the streak flame
    And I <plant> the plant

    Examples:
      | streak | flame      | plant      |
      | Off    | do not see | do not see |
      | Flame  | see        | do not see |
      | Plant  | do not see | see        |

  Scenario: Nobody sees a streak until they choose one
    When I open the app
    Then I do not see the streak flame
    And I do not see the plant
    When I open the settings
    Then the streak choice "Off" is selected

  Scenario: The streak choice follows the person to another device
    When I open the settings
    And I choose "Flame" for the streak
    And I switch to another device
    And I open the app
    Then I see the streak flame
    And I do not see the plant

  Scenario: The plant keeps growing while it is not shown
    When I open the app
    Then I do not see the plant
    When I request "GET /api/motivation"
    Then the response JSON field "plant.growth" equals "10"

  Scenario: The sunflowers grow with points by default
    When I request "GET /api/settings"
    Then the response JSON field "sunflowers" equals "grow"

  Scenario: The plant is synced across devices
    When I open the app
    And I switch to another device
    And I open the app
    And I request "GET /api/motivation"
    Then the response JSON field "plant.growth" equals "10"
