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
  still from the start. While the scene moves, its visitor passes once: a butterfly, at Halloween a bat or the little
  ghost (owner, 2026-10-24); there are no later visits until the scene moves again.
  Fall and Winter used to be only a tint with nine drifting leaves or snowflakes, so their still picture was a bare tint
  and the cat. Since the owner's decision of 2026-10-26 they have props that stay, and their leaves and snowflakes come
  to rest at fixed spots where they can be seen, as do the Christmas snowflakes (see the two rules at the end).

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
    Given the time is 2026-10-12 08:00 and the clock is running
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

  Scenario: The Mordor scene is not a season scene and its cat keeps moving
    Given the scene is "Mordor"
    And the time is 2026-10-31 18:00 and the clock is running
    When I open the week view for 2026-10-31
    And 11 seconds pass
    Then the scene's cat is moving

  Scenario: The sunflower field is not a season scene and keeps moving
    Given the scene is "Sunflower field"
    And the time is 2026-10-31 18:00 and the clock is running
    When I open the week view for 2026-10-31
    And 11 seconds pass
    Then the top bar scene is moving

  @perf
  Scenario: A still scene leaves the processor free
    Measured 2026-10-24, week view on a phone, Halloween, 3 s idle after the ten seconds, processor time of the page and
    the graphics process together: in the test container 1570-1740 ms before the scenes rested, 30-110 ms after
    (10 ms with no scene); on the laptop 430-570 ms before, 0-20 ms after. The budget leaves room for a busy machine.
    Given the seasons and holidays follow the calendar
    And the time is 2026-10-31 18:00 and the clock is running
    When I open the week view for 2026-10-31
    And 11 seconds pass
    Then the browser uses at most 250 ms of processor time in 3 seconds

  Scenario: A visitor passes once while the scene moves
    Given the seasons and holidays follow the calendar
    And the time is 2026-10-31 18:00 and the clock is running
    When I open the week view for 2026-10-31
    Then a visitor passes through the top bar scene
    When 11 seconds pass
    Then the top bar scene is still
    When 10 minutes pass
    Then the top bar scene is still

  Scenario: The visitor flies across the top bar scene
    The visitor flies through the picture, not in a corner (owner, 2026-10-26: on a phone it only fluttered in the top
    left corner, barely visible; the build had dropped its flight).
    Given the seasons and holidays follow the calendar
    And the time is 2026-10-31 18:00 and the clock is running
    When I open the week view for 2026-10-31
    Then the visitor flies across the top bar scene

  Rule: Fall and Winter have props of their own that stay
    Owner, 2026-10-26: the Fall scene has an autumn tree with an orange, red, amber and gold crown on a brown trunk,
    clearly unlike Halloween's black bare tree, and a leaf pile; the Winter scene has a snowy bare tree, a snowman with
    a red scarf and a snow drift. The props stand still (they do not sway). Each keeps its full size (tree 37 by 46 px,
    leaf pile 30 by 10, snowman 24 by 30, drift 9 px tall) in light and dark and in every header layout, and no prop
    is ever under a control. In one row on a phone no gap is wide enough for the trees and the snowman, so they are
    left out there, as the Easter hare is; the leaf pile and the drift stay. On desktop and tablets every prop sits in
    a free gap of the wider bar by the same rules.

    @backlog
    Scenario Outline: The Fall and Winter props stay when the scene rests
      Given the scene is "<theme>"
      And the time is 2026-10-12 08:00 and the clock is running
      When I open the day view for 2026-10-12
      And 11 seconds pass
      Then the top bar scene is still
      And the top bar scene shows <parts>

      Examples:
        | theme  | parts                                           |
        | Fall   | "autumn tree", "leaf pile", "leaf" and "cat"    |
        | Winter | "snowy tree", "snowman", "snow drift" and "cat" |

    @mobile @backlog
    Scenario Outline: The Fall and Winter props sit clear of the controls
      Given the scene is "<theme>"
      And the header layout is set to "<layout>"
      When I open the day view for 2026-10-12
      Then the top bar scene shows the "<prop>"
      And the "<prop>" of the top bar scene is not under a control

      Examples:
        | theme  | layout   | prop        |
        | Fall   | Two rows | autumn tree |
        | Fall   | Two rows | leaf pile   |
        | Fall   | One row  | leaf pile   |
        | Winter | Two rows | snowy tree  |
        | Winter | Two rows | snowman     |
        | Winter | Two rows | snow drift  |
        | Winter | One row  | snow drift  |

    @desktop @backlog
    Scenario Outline: On desktop the Fall and Winter props sit in a free gap at full size
      Given the scene is "<theme>"
      When I open the day view for 2026-10-12
      Then the top bar scene shows the "<prop>"
      And the "<prop>" of the top bar scene is not under a control
      And the top bar scene's parts are drawn at their full size

      Examples:
        | theme  | prop        |
        | Fall   | autumn tree |
        | Fall   | leaf pile   |
        | Winter | snowy tree  |
        | Winter | snowman     |
        | Winter | snow drift  |

    @mobile @backlog
    Scenario: In one row the Fall scene leaves out its tree
      Given the scene is "Fall"
      And the header layout is set to "One row"
      When I open the day view for 2026-10-12
      Then the top bar scene does not show the "autumn tree"
      And the top bar scene shows the "leaf pile"

    @mobile @backlog
    Scenario: In one row the Winter scene leaves out its tree and the snowman
      Given the scene is "Winter"
      And the header layout is set to "One row"
      When I open the day view for 2026-10-12
      Then the top bar scene does not show the "snowy tree"
      And the top bar scene does not show the "snowman"
      And the top bar scene shows the "snow drift"

  Rule: When the Fall, Winter or Christmas scene rests, its leaves or snowflakes lie where they can be seen
    Owner, 2026-10-26: the nine leaves (Fall) or snowflakes (Winter, Christmas) come to rest at hand-placed spots
    inside the picture, the same spots every time, placed for each header layout, so the still picture is never a bare
    tint. A resting leaf or flake may sit close to a control but never under one. The Reduced and Off animation levels
    show that same picture from the start. When the moving ends at 10 s, the leaves and snowflakes glide to their spots
    in about one second instead of jumping, so by 11 s the scene is still.

    @backlog
    Scenario Outline: After the moving the leaves or snowflakes lie still where I can see them
      Given the scene is "<theme>"
      And the time is 2026-10-12 08:00 and the clock is running
      When I open the day view for 2026-10-12
      And 11 seconds pass
      Then the top bar scene shows 9 "<particles>" at rest
      And the "top bar" still looks like "scene-<theme>-still"

      Examples:
        | theme     | particles  |
        | Fall      | leaves     |
        | Winter    | snowflakes |
        | Christmas | snowflakes |

    @backlog
    Scenario Outline: With fewer animations the scene shows the same still picture from the start
      Given the animation level is "<level>"
      And the scene is "<theme>"
      When I open the day view for 2026-10-12
      Then the top bar scene shows 9 "<particles>" at rest
      And the "top bar" still looks like "scene-<theme>-still"

      Examples:
        | level   | theme     | particles  |
        | Reduced | Fall      | leaves     |
        | Off     | Winter    | snowflakes |
        | Reduced | Christmas | snowflakes |

    @mobile @backlog
    Scenario Outline: No resting leaf or snowflake is under a control
      Given the scene is "<theme>"
      And the header layout is set to "<layout>"
      And the animation level is "Reduced"
      When I open the day view for 2026-10-12
      Then no "<particles>" of the top bar scene is under a control

      Examples:
        | theme     | layout   | particles  |
        | Fall      | One row  | leaves     |
        | Winter    | Two rows | snowflakes |
        | Christmas | One row  | snowflakes |

    @backlog
    Scenario: When the moving ends the leaves glide to their spots within a second
      Given the scene is "Fall"
      And the time is 2026-10-12 08:00 and the clock is running
      When I open the day view for 2026-10-12
      And 10 seconds pass
      Then the "leaves" of the top bar scene glide to their resting spots within 1 second
