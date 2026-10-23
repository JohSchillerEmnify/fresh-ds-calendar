@reward @adhd @id:rewarding-feedback
Feature: Rewarding feedback and delightful motion
  Ticking an item must feel satisfying: springy checkbox with a drawn check, animated strike-through
  and a small sparkle burst. Completing a whole list earns a bigger celebration: confetti-like burst,
  card bounce, progress ring filled, "All done! 🎉". Effects are short (the tick sparkle is gone
  within 1 s, the list celebration within 1.5 s), never block input and are removed from the page
  afterwards. The animation level (Full / Reduced / Off) and the system "reduce motion" preference
  are honoured; reduce motion caps the level at Reduced unless full animations are allowed despite it.
  Ticking in the open tasks tray rewards exactly like ticking in the expanded list: the same checkbox,
  strike-through speed, sparkle, bouncing done count and, for the last item, the same celebration.

  Background:
    Given the calendar is empty
    And the expanding task-list cards experiment is on
    And today is 2026-10-12
    And the calendar contains a task list "Groceries" on 2026-10-12 with items:
      | item  | done |
      | Milk  | no   |
      | Eggs  | no   |
      | Bread | yes  |

  Scenario: Ticking an item plays a short sparkle that cleans up after itself
    When I open the day view for 2026-10-12
    And I expand the task list "Groceries"
    And I tick the item "Milk"
    Then a "tick" effect appears and is removed within 1000 ms
    And the item "Milk" is ticked

  Scenario: Unticking does not celebrate
    When I open the day view for 2026-10-12
    And I expand the task list "Groceries"
    And I untick the item "Bread"
    Then no reward effect appears

  Scenario: Completing a whole list earns a bigger celebration
    When I open the day view for 2026-10-12
    And I expand the task list "Groceries"
    And I tick the item "Milk"
    And I tick the item "Eggs"
    Then a "list-complete" effect appears and is removed within 1500 ms
    And the progress ring of the task list "Groceries" shows 100 percent
    And the expanded task list shows the message "All done! 🎉"

  Scenario: Ticking an item in the open tasks tray plays the same sparkle
    When I open the day view for 2026-10-12
    And I open the open tasks tray
    And I tick the item "Milk" in the open tasks tray
    Then a "tick" effect appears and is removed within 1000 ms

  Scenario: Finishing a list in the open tasks tray earns the same celebration
    When I open the day view for 2026-10-12
    And I open the open tasks tray
    And I tick the item "Milk" in the open tasks tray
    And I tick the item "Eggs" in the open tasks tray
    Then the open tasks tray shows the message "All done! 🎉" for "Groceries"
    And a "list-complete" effect appears and is removed within 1500 ms

  Scenario: Effects never block input
    When I open the day view for 2026-10-12
    And I expand the task list "Groceries"
    And I quickly tick the items "Milk, Eggs"
    Then the item "Milk" is ticked
    And the item "Eggs" is ticked
    And the task list "Groceries" shows the done count "3/3"

  Scenario: The progress ring follows the done count
    When I open the day view for 2026-10-12
    And I expand the task list "Groceries"
    Then the progress ring of the task list "Groceries" shows 33 percent
    When I tick the item "Milk"
    Then the progress ring of the task list "Groceries" shows 67 percent

  Scenario Outline: Reduced and Off animation levels render no particles
    When I open the path "/settings"
    And I choose the animation level "<level>"
    And I open the day view for 2026-10-12
    And I expand the task list "Groceries"
    And I tick the item "Milk"
    And I tick the item "Eggs"
    Then no reward effect appears
    And the expanded task list shows the message "All done! 🎉"

    Examples:
      | level   |
      | Reduced |
      | Off     |

  Scenario: The system "reduce motion" preference caps the animation level
    Given the device prefers reduced motion
    When I open the path "/settings"
    And I choose the animation level "Full"
    And I open the day view for 2026-10-12
    And I expand the task list "Groceries"
    And I tick the item "Milk"
    Then no reward effect appears

  Scenario: I can choose full animations although the system asks for less motion
    Given the device prefers reduced motion
    When I open the path "/settings"
    Then the settings say the device asks for less motion
    When I allow full animations despite the device setting
    And I choose the animation level "Full"
    And I open the day view for 2026-10-12
    And I expand the task list "Groceries"
    And I tick the item "Milk"
    Then a "tick" effect appears and is removed within 1000 ms

  Scenario: Micro-interactions animate dialogs and menus, unless animations are off
    When I open the week view for 2026-10-12
    And I start creating an event
    Then the event dialog opened with an animation
    When I cancel the event dialog
    And I open the path "/settings"
    And I choose the animation level "Off"
    And I open the week view for 2026-10-12
    And I start creating an event
    Then the event dialog opened without an animation

  Scenario: Animation and sound settings have calm defaults
    When I open the path "/settings"
    Then the animation level "Full" is selected
    And the sounds setting is off
