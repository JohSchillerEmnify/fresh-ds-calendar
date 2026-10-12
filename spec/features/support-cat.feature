@reward @cat @id:emotional-support-cat
Feature: The emotional support cat
  Now and then (about one in ten finished task lists) a small cat comes by when I finish a list: it swipes a paw
  across the list's title and strikes it through, looks at me, grins and disappears again, in every theme. It never blocks anything. A
  setting chooses Off, Sometimes (the default) or Every time (owner: so I can see it without finishing ten lists);
  it is kept per person whatever the theme. It does not come with the animation level Off.

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And the calendar contains a task list "Groceries" on 2026-10-12 with items:
      | item | done |
      | Milk | yes  |
      | Eggs | no   |

  Scenario: The cat comes by when I finish a list
    Given the support cat comes by on the next finished list
    When I open the day view for 2026-10-12
    And I expand the task list "Groceries"
    And I tick the item "Eggs"
    Then the support cat appears and is gone within 4000 ms
    And the title of the task list "Groceries" is struck through

  Scenario: With "Every time" the cat comes on every finished list
    Given the support cat is set to "Every time" in the settings
    When I open the day view for 2026-10-12
    And I expand the task list "Groceries"
    And I tick the item "Eggs"
    Then the support cat appears and is gone within 4000 ms

  Scenario: Switched off, the cat stays away
    Given the support cat comes by on the next finished list
    And the support cat is set to "Off" in the settings
    When I open the day view for 2026-10-12
    And I expand the task list "Groceries"
    And I tick the item "Eggs"
    Then the support cat does not appear
