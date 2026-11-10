@tasklists @one-line @id:tasklists-one-line
Feature: A task list with just one line is one task
  A task list whose only line is a single task is drawn as one task (owner, 2026-11-10): either one item without a title
  (A) or a title without items (B). A and B are drawn and behave exactly the same: the list's own checkbox is the only
  checkbox, the task's text stands in the title slot without a marker of its own (same size and weight in both), and in a
  time grid block the text wraps like an event block's title (same line budget and, in narrow columns, the same smaller type), the checkbox leading it like an event's marker, and a block one line tall shows one line. A tap opens the list
  directly, even with "Grow in place" on; ticking the checkbox ticks the task (struck through, no count, no progress ring). Ticking a title-only list (B) moves its title into the one item and clears the title (owner, 2026-11-10), so a ticked B is exactly a ticked A.
  A list with a title and one item (C) grows as usual with an items area of at least 44 px, and so does a list with two
  or more items (D). The state is covered by component pictures (pnpm goldens) in every variant.

  Background:
    Given the calendar is empty
    And tapping a task list grows it in place
    And today is 2026-10-12

  Scenario: A task list with one item and no title opens the list directly
    Given the calendar contains a task list "" on 2026-10-14 with items:
      | item    | done |
      | Tickets | no   |
    When I open the day view for 2026-10-14
    And I tap the titleless task list
    Then the list sheet of the titleless task list is open
    And no task list is expanded

  Scenario: A task list with a title and no items opens the list directly
    Given the calendar contains an empty task list "Ideas" on 2026-10-14
    When I open the day view for 2026-10-14
    And I tap the task list "Ideas"
    Then the task list "Ideas" opens as the list sheet
    And no task list is expanded

  Scenario: The one item and the title are drawn alike, with the list's checkbox only
    Given the calendar contains a task list "" on 2026-10-14 with items:
      | item    | done |
      | Tickets | no   |
    And the calendar contains an empty task list "Ideas" on 2026-10-14
    When I open the day view for 2026-10-14
    Then the task lists "" and "Ideas" show one checkbox, the same type, no count and no progress bar

  Scenario: Ticking the checkbox of a list with one item and no title ticks the item
    Given the calendar contains a task list "" on 2026-10-14 with items:
      | item    | done |
      | Tickets | no   |
    When I open the day view for 2026-10-14
    And I tick the checkbox of the titleless task list
    Then the titleless task list is struck through
    And no list sheet is open
    When I reload the page
    Then the titleless task list is struck through

  Scenario: Ticking the checkbox of a list with a title and no items makes it a ticked one-item list without a title
    Given the calendar contains an empty task list "Ideas" on 2026-10-14
    When I open the day view for 2026-10-14
    And I tick the checkbox of the task list "Ideas"
    Then the titleless task list is struck through
    And the titleless task list shows the text "Ideas"
    And no list sheet is open
    When I tap the titleless task list
    Then the list sheet of the titleless task list is open
    And no task list is expanded
    When I reload the page
    Then the titleless task list is struck through

  @mobile
  Scenario: In a narrow block one line tall the checkbox leads the text on the same line
    Given the calendar contains a task list "" on 2026-10-14 at 09:00 for 15 minutes with items:
      | item    | done |
      | Tickets | no   |
    When I open the week view for 2026-10-12
    Then in the titleless task list the checkbox leads the text on its first line

  @mobile
  Scenario: A titleless list with several items in a block one line tall shows only its own checkbox
    Given the calendar contains a task list "" on 2026-10-14 at 09:00 for 15 minutes with items:
      | item | done |
      | Foo  | no   |
      | Bar  | no   |
    When I open the week view for 2026-10-12
    Then the titleless task list shows "Foo" in its title slot with only its own checkbox

  @mobile
  Scenario: A one-line task list and an event of the same size wrap their text the same way
    Given the calendar contains a task list "" on 2026-10-14 at 09:00 for 60 minutes with items:
      | item                                | done |
      | Book the train tickets for the trip | no   |
    And the calendar contains an event "Book the train tickets for the trip" on 2026-10-15 from 09:00 to 10:00
    When I open the week view for 2026-10-12
    Then the titleless task list and the event "Book the train tickets for the trip" wrap their text on the same number of lines

  Scenario: A task list with a title and one item grows in place
    Given the calendar contains a task list "Post" on 2026-10-14 with items:
      | item   | done |
      | Stamps | no   |
    When I open the day view for 2026-10-14
    And I tap the task list "Post"
    Then the task list "Post" is expanded over the calendar
