@themes @scenes @id:theme-scenes
Feature: Season themes keep my light or dark choice and bring their own scene
  The season themes (Spring, Summer, Fall and Winter) change colours, shapes and the top bar scene but
  never my choice of System, Light or Dark (owner, 2026-10-13); only Neon and Mordor are dark by design. Each season
  has a lively scene in the top bar: spring with sprouting trees and the first flowers such as lily of the valley,
  summer with sunflowers and a small sun; Halloween with a moon, bare trees, glowing jack-o'-lanterns, bats and now
  and then a little ghost (owner, 2026-10-13). Butterflies (bats at Halloween) and a cat live in every scene.
  The holiday scenes (Easter, Summer holidays, Christmas, New Year's Eve, New Year) are described in theme-menu.feature and
  ARCHITECTURE "Holiday scenes"; Christmas, New Year's Eve and New Year have a cat but no butterflies.

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And the seasons and holidays are off

  Scenario Outline: A season theme keeps my mode
    When I open the week view for 2026-10-12
    And I open the settings
    And I choose the theme mode "<mode>"
    And I choose the theme "<theme>"
    Then the app uses the <scheme> theme

    Examples:
      | mode  | theme  | scheme |
      | Dark  | Spring | dark   |
      | Light | Winter | light  |

  Scenario Outline: Each season scene has its own life, butterflies and a cat
    When I set the seasons and holidays to "Off"
    And I choose the theme "<theme>"
    Then the top bar scene shows <parts>

    Examples:
      | theme  | parts                                                      |
      | Spring | "sprouting tree", "lily of the valley", "butterfly" and "cat" |
      | Summer | "sunflower", "sun", "butterfly" and "cat"                     |
      | Halloween | "jack-o-lantern", "bat", "moon" and "cat"                  |
      | Easter | "easter egg", "hare", "first flower" and "cat"                  |
      | Summer holidays | "sea", "sun", "beach umbrella" and "cat"               |
      | Christmas | "xmas tree", "advent candle", "snow" and "cat"      |
      | New Year's Eve | "firework", "skyline", "star" and "cat"                 |
      | New Year | "sunrise", "confetti", "hill" and "cat"                       |

  @backlog
  Scenario: Butterflies come only now and then
    When I choose the theme "Spring"
    Then the top bar scene has no butterfly yet
