@themes @scenes @id:theme-scenes
Feature: Season themes keep my light or dark choice and bring their own scene
  The season themes (Spring, Summer, Fall and Winter) change colours, shapes and the top bar scene but
  never my choice of System, Light or Dark (owner, 2026-10-13); only Neon and Mordor are dark by design. Each season
  has a lively scene in the top bar: spring with sprouting trees and the first flowers such as lily of the valley,
  summer with sunflowers and a small sun; Halloween with a moon, bare trees, glowing jack-o'-lanterns, bats and now
  and then a little ghost (owner, 2026-10-13). Butterflies (bats at Halloween; birds in Fall, a robin in Winter) and a cat live in every scene.
  The holiday scenes (Easter, Summer holidays, Christmas, New Year's Eve, New Year) are described in theme-menu.feature and
  ARCHITECTURE "Holiday scenes"; Christmas, New Year's Eve and New Year have a cat but no butterflies.
  The season and holiday scenes move for about ten seconds after the app opens and then rest as a still picture, so
  they cost the phone nothing (owner, 2026-10-24: Halloween kept the processor busy 2.4-2.9 s of every 3 s). The still
  picture is the scene's resting look, the same one the Animations "Off" setting shows. Coming back to the app after
  it was hidden counts as opening it, and choosing a different scene plays it too. With reduced motion the scene is
  still from the start. While the scene moves, its visitor passes once: a butterfly, at Halloween a bat or the little
  ghost (owner, 2026-10-24), in Fall a flock of birds and in Winter a robin (owner, 2026-10-26); there are no later
  visits until the scene moves again.
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
    Owner, 2026-10-26 (round 3 mockups approved): the Fall scene has autumn trees with an orange, red, amber and gold
    crown on a brown trunk, clearly unlike Halloween's black bare tree, leaf piles and a leaf-strewn ground; the cat
    holds a kite on a string to its paw. The Winter scene has snowy bare trees, a snowman with a red scarf, a sledge and
    a snow drift, pale blue-grey in light mode. The ground runs the full width of the bar and may pass behind the
    controls. The props stand still (only the kite sways while the scene moves) and keep their full size (trees 43 to
    64 px tall, snowman 34 by 42, leaf pile 39 by 13, sledge 34 by 13, kite 16 by 20 with its tail) in light and dark;
    they spread over all the free areas of the bar and are never under the title, a button or the Today pill. A prop
    that cannot sit clear of the controls is left out, never shrunk. In one row the snowy tree is left out; the autumn
    tree and the snowman stand in the one-row gap. While the scene moves, Fall has a flock of three birds and Winter a
    robin as its visitor instead of the butterfly. In left-handed mode the whole scene is drawn mirrored.

    @backlog
    Scenario Outline: The Fall and Winter props stay when the scene rests
      Given the scene is "<theme>"
      And the time is 2026-10-12 08:00 and the clock is running
      When I open the day view for 2026-10-12
      And 11 seconds pass
      Then the top bar scene is still
      And the top bar scene shows <parts>

      Examples:
        | theme  | parts                                        |
        | Fall   | "autumn tree", "leaf pile", "kite" and "cat" |
        | Winter | "snowy tree", "snowman", "sledge" and "cat"  |

    @backlog
    Scenario Outline: The Fall and Winter ground runs the full width of the bar
      Given the scene is "<theme>"
      When I open the day view for 2026-10-12
      Then the "<ground>" of the top bar scene runs the full width of the bar

      Examples:
        | theme  | ground      |
        | Fall   | leaf litter |
        | Winter | snow drift  |

    @backlog
    Scenario Outline: The Fall and Winter props sit clear of the controls at full size
      Given the scene is "<theme>"
      When I open the day view for 2026-10-12
      Then the top bar scene shows the "<prop>"
      And the "<prop>" of the top bar scene is not under a control
      And the "<prop>" of the top bar scene is drawn at its full size

      Examples:
        | theme  | prop        |
        | Fall   | autumn tree |
        | Fall   | leaf pile   |
        | Fall   | kite        |
        | Winter | snowy tree  |
        | Winter | snowman     |
        | Winter | sledge      |

    @mobile @backlog
    Scenario Outline: In each header layout the Fall and Winter props sit clear of the controls
      Given the scene is "<theme>"
      And the header layout is set to "<layout>"
      When I open the day view for 2026-10-12
      Then the top bar scene shows the "<prop>"
      And the "<prop>" of the top bar scene is not under a control
      And the "<prop>" of the top bar scene is drawn at its full size

      Examples:
        | theme  | layout   | prop        |
        | Fall   | Two rows | autumn tree |
        | Fall   | Two rows | leaf pile   |
        | Fall   | Two rows | kite        |
        | Fall   | One row  | autumn tree |
        | Fall   | One row  | leaf pile   |
        | Fall   | One row  | kite        |
        | Winter | Two rows | snowy tree  |
        | Winter | Two rows | snowman     |
        | Winter | Two rows | sledge      |
        | Winter | One row  | snowman     |
        | Winter | One row  | sledge      |

    @mobile @backlog
    Scenario: In one row the Winter scene leaves out its tree
      Given the scene is "Winter"
      And the header layout is set to "One row"
      When I open the day view for 2026-10-12
      Then the top bar scene does not show the "snowy tree"
      And the top bar scene shows the "snowman"
      And the top bar scene shows the "snow drift"

    @backlog
    Scenario Outline: While the Fall or Winter scene moves its own visitor passes, not a butterfly
      Given the scene is "<theme>"
      And the time is 2026-10-12 08:00 and the clock is running
      When I open the day view for 2026-10-12
      Then the top bar scene shows the "<visitor>"
      And the top bar scene does not show the "butterfly"
      When 11 seconds pass
      Then the top bar scene is still
      And the top bar scene does not show the "<visitor>"

      Examples:
        | theme  | visitor    |
        | Fall   | bird flock |
        | Winter | robin      |

    @mobile @backlog
    Scenario Outline: In left-handed mode the Fall and Winter scenes are drawn mirrored
      Given left-handed mode is on
      And the scene is "<theme>"
      When I open the day view for 2026-10-12
      Then the top bar scene is drawn mirrored

      Examples:
        | theme  |
        | Fall   |
        | Winter |

  Rule: When the Fall, Winter or Christmas scene rests, its leaves or snowflakes lie where they can be seen
    Owner, 2026-10-26: the nine leaves (Fall) or snowflakes (Winter, Christmas) come to rest at hand-placed spots
    spread over the whole bar, the same spots every time, placed for each header layout, so the still picture is never
    a bare tint. A resting leaf or flake may sit close to a control but never under one. The Reduced and Off animation
    levels show that same picture from the start. When the moving ends at 10 s, the leaves and snowflakes glide to
    their spots in one second instead of jumping, so by 11 s the scene is still. The Christmas candles and tree stay as
    they are.

    @visual @backlog
    Scenario Outline: After the moving the leaves or snowflakes lie still where I can see them
      Given the scene is "<theme>"
      And the time is 2026-10-12 08:00 and the clock is running
      When I open the day view for 2026-10-12
      And 11 seconds pass
      Then the top bar scene shows 9 "<particles>" at rest
      And the "<particles>" of the top bar scene are spread over the whole bar
      And no "<particles>" of the top bar scene is under a control
      And the "top bar" still looks like "scene-<theme>-still"

      Examples:
        | theme     | particles  |
        | Fall      | leaves     |
        | Winter    | snowflakes |
        | Christmas | snowflakes |

    @visual @backlog
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

    @visual @backlog
    Scenario Outline: The Fall and Winter still pictures in the dark
      Given the device prefers a dark color scheme
      And the animation level is "Reduced"
      And the scene is "<theme>"
      When I open the day view for 2026-10-12
      Then the top bar scene shows 9 "<particles>" at rest
      And the "top bar" still looks like "scene-<theme>-still-dark"

      Examples:
        | theme  | particles  |
        | Fall   | leaves     |
        | Winter | snowflakes |

    @mobile @backlog
    Scenario Outline: In each header layout no resting leaf or snowflake is under a control
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
