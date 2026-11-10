@tasklists @one-line @id:tasklists-one-line
Feature: A task list with just one line is one task
  A task list whose only line is a single task is drawn as one task (owner, 2026-11-10): either one item without a title
  (A) or a title without items (B). A and B are drawn and behave exactly the same: the list's own checkbox is the only
  checkbox, the task's text stands in the title slot without a marker of its own (same size and weight in both), and in a
  narrow column the checkbox sits on its own line with the text below it using the whole width. A tap opens the list
  directly, even with "Grow in place" on; ticking the checkbox ticks the task (struck through, no count, no progress ring).
  A list with a title and one item (C) grows as usual with an items area of at least 44 px, and so does a list with two
  or more items (D). The state is covered by component pictures (pnpm goldens) in every variant.

  Background:
    Given the calendar is empty
    And tapping a task list grows it in place
    And today is 2026-10-12
    And the calendar contains a task list "" on 2026-10-14 with items:
      | item    | done |
      | Tickets | no   |
    And the calendar contains an empty task list "Ideas" on 2026-10-14

  Scenario: A task list with one item and no title opens the list directly
    When I open the day view for 2026-10-14
    And I tap the titleless task list
    Then the list sheet of the titleless task list is open
    And no task list is expanded

  Scenario: A task list with a title and no items opens the list directly
    When I open the day view for 2026-10-14
    And I tap the task list "Ideas"
    Then the task list "Ideas" opens as the list sheet
    And no task list is expanded

  Scenario: The one item and the title are drawn alike, with the list's checkbox only
    When I open the day view for 2026-10-14
    Then the task lists "" and "Ideas" show one checkbox, the same type, no count and no progress bar

  Scenario: Ticking the checkbox of a list with one item and no title ticks the item
    When I open the day view for 2026-10-14
    And I tick the checkbox of the titleless task list
    Then the titleless task list is struck through
    And no list sheet is open
    When I reload the page
    Then the titleless task list is struck through

  Scenario: Ticking the checkbox of a list with a title and no items ticks the title
    When I open the day view for 2026-10-14
    And I tick the checkbox of the task list "Ideas"
    Then the title of the task list "Ideas" is struck through
    And no list sheet is open
    When I reload the page
    Then the title of the task list "Ideas" is struck through

  @mobile
  Scenario: In a narrow column the checkbox sits on its own line above the text
    When I open the week view for 2026-10-12
    Then in the task list "Ideas" the checkbox sits above the text
    And in the titleless task list the checkbox sits above the text

  Scenario: A task list with a title and one item grows in place
    Given the calendar contains a task list "Post" on 2026-10-14 with items:
      | item   | done |
      | Stamps | no   |
    When I open the day view for 2026-10-14
    And I tap the task list "Post"
    Then the task list "Post" is expanded over the calendar
