@tasklists @repeating @optional @id:tasklist-repeating
Feature: Changing a repeating task list for this week or all weeks
  Renaming a repeating task list, adding an item, changing an item's text or removing an item asks first whether the
  change is for "This week" or "All weeks", the way Google asks for a repeating event (owner, 2026-10-24). "This week"
  changes only the week shown (it becomes a week of its own, as a tick does). "All weeks" changes the series in Google
  and every week that was already split off, past weeks included: each week keeps its own ticks, an item added for all
  weeks arrives unticked everywhere. Ticking never asks: every week is ticked on its own (feature adhd-support).
  A daily list says "This day / All days", a monthly one "This month / All months".

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And the calendar contains a weekly task list "Clean bathroom" on Mondays since 2026-10-12 with items:
      | item  | done |
      | Sink  | no   |
      | Floor | no   |

  Scenario: Adding an item to a repeating list asks for this week or all weeks
    When I open the day view for 2026-10-19
    And I expand the task list "Clean bathroom"
    And I add the item "Mirror"
    Then I am asked whether to change "This week" or "All weeks"
    And "This week" is chosen

  Scenario: An item added for all weeks shows in every week, and a week ticked before keeps its tick
    Given "Sink" of "Clean bathroom" was ticked on 2026-10-12
    When I open the day view for 2026-10-19
    And I expand the task list "Clean bathroom"
    And I add the item "Mirror"
    And I choose "All weeks" for the change
    Then the expanded task list items are "Sink, Floor, Mirror"
    When I open the week view for 2026-10-26
    Then the collapsed task list "Clean bathroom" lists the items "Sink, Floor, Mirror"
    And the task list "Clean bathroom" shows the done count "0/3"
    When I open the week view for 2026-10-12
    Then the collapsed task list "Clean bathroom" lists the items "Sink, Floor, Mirror"
    And the task list "Clean bathroom" shows the done count "1/3"

  Scenario: An item added for this week only stays in that week
    When I open the day view for 2026-10-19
    And I expand the task list "Clean bathroom"
    And I add the item "Mirror"
    And I choose "This week" for the change
    Then the expanded task list items are "Sink, Floor, Mirror"
    When I open the week view for 2026-10-26
    Then the collapsed task list "Clean bathroom" lists the items "Sink, Floor"

  Scenario: Renaming a repeating list for all weeks reaches a week that was split off, and its ticks stay
    Given "Floor" of "Clean bathroom" was ticked on 2026-10-26
    When I open the day view for 2026-10-19
    And I expand the task list "Clean bathroom"
    And I rename the expanded task list to "Bathroom"
    And I choose "All weeks" for the change
    Then the task list "Bathroom" is expanded
    When I open the week view for 2026-10-26
    Then I see the task list "Bathroom" on 2026-10-26
    And the task list "Bathroom" shows the done count "1/2"
    When I open the week view for 2026-11-02
    Then I see the task list "Bathroom" on 2026-11-02

  Scenario: Changing an item's text for all weeks keeps each week's ticks
    Given "Sink" of "Clean bathroom" was ticked on 2026-10-12
    When I open the day view for 2026-10-19
    And I expand the task list "Clean bathroom"
    And I rename the item "Sink" to "Basin"
    And I choose "All weeks" for the change
    Then the expanded task list items are "Basin, Floor"
    When I open the week view for 2026-10-12
    Then the collapsed task list "Clean bathroom" lists the items "Basin, Floor"
    And the task list "Clean bathroom" shows the done count "1/2"
    When I open the week view for 2026-10-26
    Then the collapsed task list "Clean bathroom" lists the items "Basin, Floor"
    And the task list "Clean bathroom" shows the done count "0/2"

  Scenario: Removing an item for all weeks removes it from every week once the undo time is over
    Given "Floor" of "Clean bathroom" was ticked on 2026-10-12
    When I open the day view for 2026-10-19
    And I expand the task list "Clean bathroom"
    And I delete the item "Floor"
    And I choose "All weeks" for the change
    Then the expanded task list items are "Sink"
    When the undo time is over
    And I open the week view for 2026-10-12
    Then the collapsed task list "Clean bathroom" lists the items "Sink"
    When I open the week view for 2026-10-26
    Then the collapsed task list "Clean bathroom" lists the items "Sink"

  Scenario: Cancelling the choice changes nothing
    When I open the day view for 2026-10-19
    And I expand the task list "Clean bathroom"
    And I rename the item "Sink" to "Basin"
    And I cancel the choice
    Then the expanded task list items are "Sink, Floor"
    When I reload the page
    And I open the week view for 2026-10-26
    Then the collapsed task list "Clean bathroom" lists the items "Sink, Floor"

  Scenario: Renaming in the task list form asks too; the other changes stay with this week
    When I open the day view for 2026-10-19
    And I expand the task list "Clean bathroom"
    And I edit the task list details
    And I fill in the task list form with:
      | title    | Bathroom |
      | estimate | 20       |
    And I save the task list
    And I choose "All weeks" for the change
    Then the task list dialog is closed
    When I open the week view for 2026-10-26
    Then I see the task list "Bathroom" on 2026-10-26
    And the task list "Bathroom" has no estimate
    When I open the week view for 2026-10-19
    Then the task list "Bathroom" shows the estimate "~20 min"

  Scenario: Ticking an item of a repeating list never asks
    When I open the day view for 2026-10-19
    And I expand the task list "Clean bathroom"
    And I tick the item "Sink"
    Then the task list "Clean bathroom" shows the done count "1/2"
    And I am not asked which weeks to change

  Scenario: A list that does not repeat never asks
    Given the calendar contains a task list "Groceries" on 2026-10-14 with items:
      | item | done |
      | Milk | no   |
    When I open the day view for 2026-10-14
    And I expand the task list "Groceries"
    And I add the item "Eggs"
    Then the expanded task list items are "Milk, Eggs"
    And I am not asked which weeks to change
