@plant @sunflowers @reward @id:sunflower-field
Feature: Sunflower field
  The Sunflower field is a scene (a choice of the top app bar background in the theme menu): a small landscape
  (sky, soft rolling hills, a few drifting clouds, a bee now and then) with a row of sunflowers in front. It shows
  whenever it is the chosen scene, whatever the plant setting. The Motivation setting "Sunflowers" decides how many
  flowers: "Grow with points" (default) grows one flower per 40 growth points (same points as the plant), at most
  30; "Full field" shows a fixed full field without growing. Phones (under 600 px) show at most 15, wider screens up
  to 30. Flowers sway gently (paused when animations are Reduced or Off, or the app is hidden), share the plant's
  mood (resting flowers droop and fade gently), never disappear and never die. A newly earned sunflower grows in
  with a short animation.

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And the scene is "Sunflower field"

  Scenario: The field shows one sunflower per 40 growth points
    Given the plant has 200 growth points and was last watered on 2026-10-12
    When I open the app
    Then I see the sunflower field
    And the sunflower field shows 5 flowers
    And the sunflower field is labelled "Sunflower field: 5 flowers"

  Scenario: The field shows whatever the plant setting is
    When I open the path "/settings"
    And I turn the plant "off"
    And I open the app
    Then I see the sunflower field
    And I do not see the plant

  Scenario: Without the scene there is no field
    Given the scene is "None"
    When I open the app
    Then I do not see the sunflower field

  Scenario: The field sits in a small landscape
    Given the plant has 200 growth points and was last watered on 2026-10-12
    When I open the app
    Then the top bar scene shows "sky", "hills", "cloud" and "sunflower"

  Scenario: A new sunflower grows in when enough points are earned
    Given the plant has 39 growth points and was last watered on 2026-10-11
    When I open the app
    Then a "bloom" effect appears and is removed within 1500 ms
    And the sunflower field shows 1 flower
    And the sunflower field is labelled "Sunflower field: 1 flower"

  @mobile
  Scenario: A full field fits a phone's top app bar
    Given I am using a phone
    And the plant has 2000 growth points and was last watered on 2026-10-12
    When I open the app
    Then the sunflower field shows 15 flowers
    And the sunflower field is labelled "Sunflower field: 30 flowers"
    And the page has no horizontal scroll

  @desktop
  Scenario: A full field on a wide screen shows up to 30 flowers
    Given the plant has 2000 growth points and was last watered on 2026-10-12
    When I open the app
    Then the sunflower field shows 30 flowers

  @desktop
  Scenario: The full field setting shows a fixed field without growing
    Given the plant has 0 growth points and was last watered on 2026-10-12
    And the sunflowers are set to "Full field"
    When I open the app
    Then the sunflower field shows 30 flowers
    And the sunflower field is labelled "Sunflower field: 30 flowers"

  @mobile
  Scenario: The full field setting fits a phone
    Given I am using a phone
    And the sunflowers are set to "Full field"
    When I open the app
    Then the sunflower field shows 15 flowers

  Scenario: The sunflowers setting is active only with the Sunflower field scene
    When I open the path "/settings"
    Then the sunflowers setting is active
    When I open the app
    And I pick "Mordor" for "Scene"
    And I open the path "/settings"
    Then the sunflowers setting is inactive
    And the sunflowers hint says "Applies to the Sunflower field scene"

  Scenario: The sunflowers setting is chosen in the settings
    When I open the path "/settings"
    And I choose "Full field" for the sunflowers
    And I request "GET /api/settings"
    Then the response JSON field "sunflowers" equals "full"

  Scenario Outline: The field never hurts legibility of the top app bar
    Given the device prefers a <scheme> color scheme
    And the plant has 2000 growth points and was last watered on 2026-10-12
    When I open the week view for 2026-10-12
    Then the period title has a contrast ratio of at least 4.5

    Examples:
      | scheme |
      | light  |
      | dark   |

  Scenario: Sunflowers sway only when animations are on and the app is visible
    Given the plant has 200 growth points and was last watered on 2026-10-12
    When I open the app
    Then the sunflowers are swaying
    When the app is hidden
    Then the sunflowers are not swaying
    When the app regains focus
    Then the sunflowers are swaying

  Scenario Outline: Reduced or Off animation levels stop the sway
    Given the plant has 200 growth points and was last watered on 2026-10-12
    And the animation level is "<level>"
    When I open the app
    Then the sunflowers are not swaying

    Examples:
      | level   |
      | Reduced |
      | Off     |

  Scenario: A resting field droops but keeps every flower, and perks up when watered
    Given the plant has 200 growth points and was last watered on 2026-10-01
    When I request "GET /api/motivation"
    Then the response JSON field "plant.flowers" equals "5"
    And the response JSON field "plant.mood" equals "droopy"
    When I open the app
    Then a "perk-up" effect appears and is removed within 1500 ms
    And the sunflowers look "happy"
    And the sunflower field shows 5 flowers

  @butterfly
  Scenario: A butterfly visits the field once per session
    Given the plant has 200 growth points and was last watered on 2026-10-12
    When I open the app
    Then a "butterfly" effect appears and is removed within 5000 ms
    When I reload the page
    Then no "butterfly" effect appears

  @butterfly
  Scenario Outline: No butterfly with reduced or no animations, or an empty field
    Given the plant has <growth> growth points and was last watered on 2026-10-12
    And the animation level is "<level>"
    When I open the app
    Then no "butterfly" effect appears

    Examples:
      | growth | level   |
      | 200    | Reduced |
      | 200    | Off     |
      | 0      | Full    |

  @butterfly
  Scenario: The butterfly never blocks the top app bar
    Given the plant has 200 growth points and was last watered on 2026-10-12
    When I open the week view for 2026-10-12
    And I go to the next period
    Then the URL path is "/week/2026-10-19"
