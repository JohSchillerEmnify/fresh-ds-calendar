@themes @scenes @id:theme-scenes
Feature: Season themes keep my light or dark choice and bring their own scene
  The season themes (Spring, Summer, Fall and Winter) change colours, shapes and the top bar scene but
  never my choice of System, Light or Dark (owner, 2026-10-13); only Neon and Mordor are dark by design. Each season
  has a lively scene in the top bar: spring with sprouting trees and the first flowers such as lily of the valley,
  summer with sunflowers and a small sun; Halloween with a moon, bare trees, glowing jack-o'-lanterns, bats and now
  and then a little ghost (owner, 2026-10-13). Butterflies (bats at Halloween) and a cat live in every scene.
  The holiday scenes (Easter, Summer holidays, Christmas, New Year's Eve, New Year) are described in theme-menu.feature and
  ARCHITECTURE "Holiday scenes"; Christmas, New Year's Eve and New Year have a cat but no butterflies.
  The season and holiday scenes move for about ten seconds after the app opens and then rest as a still picture, so
  they cost the phone nothing (owner, 2026-10-24: Halloween kept the processor busy 2.4-2.9 s of every 3 s). The still
  picture is the scene's resting look, the same one the Animations "Off" setting shows. Coming back to the app after
  it was hidden counts as opening it, and choosing a different scene plays it too. With reduced motion the scene is
  still from the start.

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

  Scenario Outline: Each season and holiday scene has its own life and a cat
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

  Scenario: The Halloween scene moves after I open the app
    Given the seasons and holidays follow the calendar
    And the time is 2026-10-31 18:00 and the clock is running
    When I open the week view for 2026-10-31
    Then the top bar shows the "halloween" scene
    And the top bar scene is moving

  Scenario: The scene becomes a still picture after about ten seconds
    Given the seasons and holidays follow the calendar
    And the time is 2026-10-31 18:00 and the clock is running
    When I open the week view for 2026-10-31
    And 11 seconds pass
    Then the top bar scene is still

  Scenario: With reduced motion the scene is still from the start
    Given the device prefers reduced motion
    And the seasons and holidays follow the calendar
    And the time is 2026-10-31 18:00 and the clock is running
    When I open the week view for 2026-10-31
    Then the top bar shows the "halloween" scene
    And the top bar scene is still

  Scenario: Coming back to the app plays the scene again
    Given the seasons and holidays follow the calendar
    And the time is 2026-10-31 18:00 and the clock is running
    When I open the week view for 2026-10-31
    And 11 seconds pass
    And the app is hidden
    And the app regains focus
    Then the top bar scene is moving
    When 11 seconds pass
    Then the top bar scene is still

  @perf
  Scenario: A still scene leaves the processor free
    Measured 2026-10-24, week view on a phone, Halloween, 3 s idle after the ten seconds, processor time of the page and
    the graphics process together: in the test container 1570-1740 ms before the scenes rested, 30-110 ms after
    (10 ms with no scene); on the laptop 430-570 ms before, 0-20 ms after. The budget leaves room for a busy machine.
    Given the seasons and holidays follow the calendar
    And the time is 2026-10-31 18:00 and the clock is running
    When I open the week view for 2026-10-31
    And 11 seconds pass
    Then the browser uses at most 400 ms of processor time in 3 seconds

  @backlog
  Scenario: Butterflies come only now and then
    When I choose the theme "Spring"
    Then the top bar scene has no butterfly yet
