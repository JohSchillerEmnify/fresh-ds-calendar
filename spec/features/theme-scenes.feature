@themes @scenes @id:theme-scenes
Feature: Season themes keep my light or dark choice and bring their own scene
  The season themes (Spring, Summer, Fall, Winter and so Automatic) change colours, shapes and the top bar scene but
  never my choice of System, Light or Dark (owner, 2026-10-13); only Neon and Mordor are dark by design. Each season
  has a lively scene in the top bar: spring with sprouting trees and the first flowers such as lily of the valley,
  summer with sunflowers and a small sun. Butterflies and a cat live in every scene.

  Background:
    Given the calendar is empty
    And today is 2026-10-12

  Scenario Outline: A season theme keeps my mode
    When I open the settings
    And I choose the theme mode "<mode>"
    And I choose the theme "<theme>"
    Then the app uses the <scheme> theme

    Examples:
      | mode  | theme  | scheme |
      | Dark  | Spring | dark   |
      | Light | Winter | light  |

  Scenario Outline: Each season scene has its own life, butterflies and a cat
    When I choose the theme "<theme>"
    Then the top bar scene shows <parts>

    Examples:
      | theme  | parts                                                      |
      | Spring | "sprouting tree", "lily of the valley", "butterfly" and "cat" |
      | Summer | "sunflower", "sun", "butterfly" and "cat"                     |
