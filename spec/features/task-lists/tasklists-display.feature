@tasklists @display @id:tasklist-display
Feature: Task lists in the calendar views
  A task list is placed on a date, optionally at a time. Collapsed it shows its title,
  its open item titles, as many as there is room for (no fixed limit; untimed lists show them all), and a
  done count like "1/3" with a progress ring (a list with just one item shows neither, nor the thin progress bar, open or ticked; its opened list keeps count and ring). A timed task list's place in the time
  grid tells its time; a short block does not repeat it as text.
  On phones, the month view shows only compact chips; tapping the day opens the day view.
  A timed task list in the grid shows its items next to the title only in a card about 400 px wide or more (owner,
  2026-11-10); a narrower card puts them in rows below the title whenever at least one row fits, and only a block one
  line tall runs them next to the title; a timed task list with open items is always tall enough for one.

  Background:
    Given the calendar is empty
    And tapping a task list grows it in place
    And today is 2026-10-12
    And the calendar contains a task list "Groceries" on 2026-10-14 with items:
      | item  | done |
      | Milk  | yes  |
      | Eggs  | no   |
      | Bread | no   |

  Scenario Outline: A task list appears in every view
    When I open the <view> view for <period>
    Then I see the task list "Groceries" on 2026-10-14

    Examples:
      | view  | period     |
      | month | 2026-10    |
      | week  | 2026-10-12 |
      | day   | 2026-10-14 |

  Scenario Outline: A collapsed task list shows title, item titles and done count
    When I open the <view> view for <period>
    Then the task list "Groceries" is collapsed
    And the collapsed task list "Groceries" lists the items "Milk, Eggs, Bread"
    And the task list "Groceries" shows the done count "1/3"

    Examples:
      | view  | period     |
      | week  | 2026-10-12 |
      | day   | 2026-10-14 |

  @month @desktop
  Scenario: A collapsed task list in the desktop month view shows items and done count
    When I open the month view for 2026-10
    Then the collapsed task list "Groceries" lists the items "Milk, Eggs, Bread"
    And the task list "Groceries" shows the done count "1/3"

  @week
  Scenario: A task list without a time is shown in the all-day area
    When I open the week view for 2026-10-12
    Then the task list "Groceries" is shown in the all-day area on 2026-10-14

  Scenario Outline: A task list with a time is placed in the time grid
    Given the calendar contains a task list "Packing" on 2026-10-15 at 18:00 with items:
      | item     | done |
      | Passport | no   |
    When I open the <view> view for <period>
    Then the task list "Packing" is positioned at 18:00

    Examples:
      | view | period     |
      | week | 2026-10-12 |
      | day  | 2026-10-15 |

  # Owner 2026-10-30: one tick item needs neither "1/1" nor the circle, open or ticked, everywhere the list is drawn collapsed.
  Scenario Outline: A task list with one open item shows no count and no progress ring
    Given the calendar contains a task list "Bahn" on 2026-10-14 with items:
      | item    | done |
      | Tickets | no   |
    When I open the <view> view for <period>
    Then I see the task list "Bahn" on 2026-10-14
    And the task list "Bahn" shows no done count
    And the task list "Bahn" shows no progress ring

    Examples:
      | view  | period     |
      | month | 2026-10    |
      | week  | 2026-10-12 |
      | day   | 2026-10-14 |

  Scenario Outline: A ticked task list with one item stays struck through and shows no count and no progress ring
    Given the calendar contains a task list "Bahn" on 2026-10-14 with items:
      | item    | done |
      | Tickets | yes  |
    When I open the <view> view for <period>
    Then the title of the task list "Bahn" is struck through
    And the task list "Bahn" shows no done count
    And the task list "Bahn" shows no progress ring

    Examples:
      | view  | period     |
      | month | 2026-10    |
      | week  | 2026-10-12 |
      | day   | 2026-10-14 |

  Scenario Outline: A task list with one item shows no thin progress bar
    Given the calendar contains a task list "Bahn" on 2026-10-14 with items:
      | item    | done   |
      | Tickets | <done> |
    When I open the <view> view for <period>
    Then I see the task list "Bahn" on 2026-10-14
    And the task list "Bahn" shows no progress bar

    Examples:
      | done | view  | period     |
      | no   | month | 2026-10    |
      | yes  | month | 2026-10    |
      | no   | week  | 2026-10-12 |
      | yes  | day   | 2026-10-14 |

  # Owner 2026-10-30: a screen reader needs only "done" or "not done" for one item, not "1 of 1".
  Scenario Outline: A task list with one item is announced as done or not done
    Given the calendar contains a task list "Bahn" on 2026-10-14 with items:
      | item    | done   |
      | Tickets | <done> |
    When I open the day view for 2026-10-14
    Then the task list "Bahn" is announced as "<label>"

    Examples:
      | done | label          |
      | no   | Bahn, not done |
      | yes  | Bahn, done     |

  Scenario: A task list with two items still shows its done count and progress ring
    When I open the day view for 2026-10-14
    Then the task list "Groceries" shows the done count "1/3"
    And the task list "Groceries" shows the progress ring
    And the task list "Groceries" shows the progress bar

  Scenario: A task list with several items is announced with its count
    Given the calendar contains a task list "Packing" on 2026-10-14 with items:
      | item     | done |
      | Passport | yes  |
      | Tickets  | no   |
    When I open the day view for 2026-10-14
    Then the task list "Packing" is announced as "Packing, 1 of 2 done"

  Scenario: The opened list of a one-item task list keeps its count and progress ring
    Given the calendar contains a task list "Bahn" on 2026-10-14 with items:
      | item    | done |
      | Tickets | no   |
    When I open the day view for 2026-10-14
    And I expand the task list "Bahn"
    Then the task list "Bahn" shows the done count "0/1"
    And the progress ring of the task list "Bahn" shows 0 percent

  @mobile @week
  Scenario: A short timed task list in a narrow week column shows its items below the title
    Given the calendar contains a task list "Einkaufen" on 2026-10-14 at 14:45 for 45 minutes with items:
      | item | done |
      | Milk | no   |
      | Eggs | no   |
    When I open the week view for 2026-10-12
    Then the task list "Einkaufen" shows the item "Milk" below its title

  # Superseded by "task lists are drawn to scale like events" (owner 2026-10-13): a 15-minute list is too short for an item line. Pending owner confirmation.
  @mobile @week @backlog
  Scenario: A very short timed task list in a narrow week column still shows its item below the title
    Given the calendar contains a task list "Call mum" on 2026-10-14 at 09:00 for 15 minutes with items:
      | item             | done |
      | Ask about Sunday | no   |
    When I open the week view for 2026-10-12
    Then the task list "Call mum" shows the item "Ask about Sunday" below its title
    And the task list "Call mum" shows no done count

  @day
  Scenario: A done timed task list in the day view shows its title without overlap
    Given the calendar contains a task list "Liste" on 2026-10-14 at 11:00 for 30 minutes with items:
      | item  | done |
      | Chore | yes  |
    When I open the day view for 2026-10-14
    Then the task list "Liste" shows its title without overlap

  @mobile @day
  Scenario: A short timed task list in the phone day view shows its items below the title
    Given the calendar contains a task list "Einkaufen" on 2026-10-14 at 14:45 for 60 minutes with items:
      | item | done |
      | Milk | no   |
      | Eggs | no   |
    When I open the day view for 2026-10-14
    Then the task list "Einkaufen" shows the item "Milk" below its title

  @desktop @day
  Scenario: A short timed task list in a wide column shows its items next to the title
    Given the calendar contains a task list "Einkaufen" on 2026-10-14 at 14:45 for 45 minutes with items:
      | item | done |
      | Milk | no   |
      | Eggs | no   |
    When I open the day view for 2026-10-14
    Then the task list "Einkaufen" shows the item "Milk" next to its title

  @desktop @day
  Scenario: A short timed task list in a wide column shows only its open items next to the title
    Given the calendar contains a task list "Einkaufen" on 2026-10-14 at 14:45 for 45 minutes with items:
      | item     | done |
      | Oat milk | no   |
      | Pasta    | yes  |
      | Bread    | no   |
      | Tomatoes | no   |
    When I open the day view for 2026-10-14
    Then the task list "Einkaufen" shows the item "Tomatoes" next to its title
    And the task list "Einkaufen" does not show the item "Pasta"

  @desktop @day
  Scenario: A tall timed task list shows as many items below the title as fit
    Given the calendar contains a task list "Packing" on 2026-10-14 at 09:00 for 180 minutes with items:
      | item      | done |
      | Passport  | no   |
      | Charger   | no   |
      | Tickets   | no   |
      | Sunscreen | no   |
      | Book      | no   |
    When I open the day view for 2026-10-14
    Then the task list "Packing" shows the item "Book" below its title

  @desktop @week
  Scenario: A task list without a time shows all of its open items in the all-day area
    Given the calendar contains a task list "Weekend" on 2026-10-14 with items:
      | item      | done |
      | Laundry   | no   |
      | Groceries | no   |
      | Bike      | no   |
      | Plants    | no   |
      | Call mum  | no   |
    When I open the week view for 2026-10-12
    Then the task list "Weekend" shows the item "Call mum" below its title

  Scenario: An empty task list is one task: its title, one checkbox, no count and no placeholder
    Given the calendar contains an empty task list "Ideas" on 2026-10-14
    When I open the day view for 2026-10-14
    Then the task list "Ideas" shows no done count
    And the task list "Ideas" shows no placeholder

  Scenario: A task list on another day is not shown in the day view
    When I open the day view for 2026-10-13
    Then I do not see the task list "Groceries"

  Scenario Outline: Tapping a collapsed task list expands it
    When I open the <view> view for <period>
    And I expand the task list "Groceries"
    Then the task list "Groceries" is expanded
    And the expanded task list items are "Milk, Eggs, Bread"
    And the item "Milk" is ticked
    And the item "Eggs" is not ticked
    When I collapse the task list
    Then no list sheet is open

    Examples:
      | view | period     |
      | week | 2026-10-12 |
      | day  | 2026-10-14 |

  @month @desktop
  Scenario: Expanding a task list from the desktop month view
    When I open the month view for 2026-10
    And I expand the task list "Groceries"
    Then the task list "Groceries" is expanded

  Scenario: Escape closes the list sheet of an expanded task list
    When I open the day view for 2026-10-14
    And I expand the task list "Groceries"
    And I press Escape
    Then no list sheet is open

  Scenario: A task list created in Google with only a description is still readable
    Given Google contains a raw task list event "Legacy" on 2026-10-14 with the description:
      """
      ☑ Call bank
      ☐ Pay rent
      """
    When I open the day view for 2026-10-14
    Then the collapsed task list "Legacy" lists the items "Call bank, Pay rent"
    And the task list "Legacy" shows the done count "1/2"

  @desktop @day
  Scenario: A task list with more items than fit fades out at the bottom
    Given the calendar contains a task list "Packing" on 2026-10-14 at 09:00 for 45 minutes with items:
      | item      | done |
      | Passport  | no   |
      | Charger   | no   |
      | Tickets   | no   |
      | Sunscreen | no   |
      | Book      | no   |
      | Snacks    | no   |
      | Headphones| no   |
      | Socks     | no   |
    When I open the day view for 2026-10-14
    Then the items of the task list "Packing" fade out towards the bottom
    And the task list "Packing" shows no overflow count

  @mobile
  Scenario Outline: The task section switch has two levels and never shows a task count
    When I open the <view> view for <period>
    And I tap the band's section switch twice
    Then the band's lists are one-line pills
    And no day in the band shows a task count instead of its lists

    Examples:
      | view | period     |
      | week | 2026-10-12 |
      | day  | 2026-10-14 |

  @mobile
  Scenario: A titleless list's one-line month chip shows its tasks in place of a title
    Given the calendar contains a task list "" on 2026-10-15 with items:
      | item  | done |
      | Milk  | no   |
      | Eggs  | no   |
      | Bread | no   |
    When I open the month view for 2026-10
    Then the titleless task list on 2026-10-15 is labelled "Milk, Eggs, Bread"
