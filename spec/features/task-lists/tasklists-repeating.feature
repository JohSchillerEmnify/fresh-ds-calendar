@tasklists @repeating @optional @id:tasklist-repeating
Feature: Changing a repeating task list for this one or this and all following ones
  Renaming a repeating task list, adding an item, changing an item's text or removing an item asks first whether the
  change is for "This task list" or "This and all following task lists", the way Google asks "This event / This and
  following events" for a repeating event (owner, 2026-10-24; the same words for every repeat rhythm). "This task list"
  changes only the one shown (it becomes one of its own, as a tick does). "This and all following task lists" changes the
  one shown and every later one, also later ones that were already ticked in: each keeps its own ticks, an item added
  arrives unticked. Earlier ones are never changed (owner: a past task list should stay as it was). In Google the list is
  then split into parts, as Google Calendar does; a later change reaches every later part of the same list. Ticking never
  asks: each one is ticked on its own (feature adhd-support).

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And the calendar contains a weekly task list "Clean bathroom" on Mondays since 2026-10-12 with items:
      | item  | done |
      | Sink  | no   |
      | Floor | no   |

  Scenario: Adding an item to a repeating list asks for this one or this and all following ones
    When I open the day view for 2026-10-19
    And I expand the task list "Clean bathroom"
    And I add the item "Mirror"
    Then I am asked whether to change "This task list" or "This and all following task lists"
    And "This task list" is chosen

  Scenario: An item added for this and all following lists reaches the later ones, keeps their ticks and leaves earlier ones alone
    Given "Sink" of "Clean bathroom" was ticked on 2026-10-12
    And "Floor" of "Clean bathroom" was ticked on 2026-10-26
    When I open the day view for 2026-10-19
    And I expand the task list "Clean bathroom"
    And I add the item "Mirror"
    And I choose "This and all following task lists" for the change
    Then the expanded task list items are "Sink, Floor, Mirror"
    When I open the week view for 2026-10-26
    Then the collapsed task list "Clean bathroom" lists the items "Sink, Floor, Mirror"
    And the task list "Clean bathroom" shows the done count "1/3"
    When I open the week view for 2026-11-02
    Then the collapsed task list "Clean bathroom" lists the items "Sink, Floor, Mirror"
    And the task list "Clean bathroom" shows the done count "0/3"
    When I open the week view for 2026-10-12
    Then the collapsed task list "Clean bathroom" lists the items "Sink, Floor"
    And the task list "Clean bathroom" shows the done count "1/2"

  Scenario: An item added for this task list only stays in that one
    When I open the day view for 2026-10-19
    And I expand the task list "Clean bathroom"
    And I add the item "Mirror"
    And I choose "This task list" for the change
    Then the expanded task list items are "Sink, Floor, Mirror"
    When I open the week view for 2026-10-26
    Then the collapsed task list "Clean bathroom" lists the items "Sink, Floor"

  Scenario: Renaming for this and all following lists reaches a later one that was ticked in, and leaves earlier ones alone
    Given "Floor" of "Clean bathroom" was ticked on 2026-10-26
    When I open the day view for 2026-10-19
    And I expand the task list "Clean bathroom"
    And I rename the expanded task list to "Bathroom"
    And I choose "This and all following task lists" for the change
    Then the task list "Bathroom" is expanded
    When I open the week view for 2026-10-26
    Then I see the task list "Bathroom" on 2026-10-26
    And the task list "Bathroom" shows the done count "1/2"
    When I open the week view for 2026-11-02
    Then I see the task list "Bathroom" on 2026-11-02
    When I open the week view for 2026-10-12
    Then I see the task list "Clean bathroom" on 2026-10-12

  Scenario: Changing an item's text for this and all following lists keeps their ticks and leaves earlier ones alone
    Given "Sink" of "Clean bathroom" was ticked on 2026-10-26
    When I open the day view for 2026-10-19
    And I expand the task list "Clean bathroom"
    And I rename the item "Sink" to "Basin"
    And I choose "This and all following task lists" for the change
    Then the expanded task list items are "Basin, Floor"
    When I open the week view for 2026-10-26
    Then the collapsed task list "Clean bathroom" lists the items "Basin, Floor"
    And the task list "Clean bathroom" shows the done count "1/2"
    When I open the week view for 2026-10-12
    Then the collapsed task list "Clean bathroom" lists the items "Sink, Floor"

  Scenario: Removing an item for this and all following lists removes it from the later ones once the undo time is over
    Given "Floor" of "Clean bathroom" was ticked on 2026-10-12
    When I open the day view for 2026-10-19
    And I expand the task list "Clean bathroom"
    And I delete the item "Floor"
    And I choose "This and all following task lists" for the change
    Then the expanded task list items are "Sink"
    When the undo time is over
    And I open the week view for 2026-10-26
    Then the collapsed task list "Clean bathroom" lists the items "Sink"
    When I open the week view for 2026-10-12
    Then the collapsed task list "Clean bathroom" lists the items "Sink, Floor"
    And the task list "Clean bathroom" shows the done count "1/2"

  Scenario: Cancelling the choice changes nothing
    When I open the day view for 2026-10-19
    And I expand the task list "Clean bathroom"
    And I rename the item "Sink" to "Basin"
    And I cancel the choice
    Then the expanded task list items are "Sink, Floor"
    When I reload the page
    And I open the week view for 2026-10-26
    Then the collapsed task list "Clean bathroom" lists the items "Sink, Floor"

  Scenario: Renaming in the task list form asks too; the other changes stay with this one
    When I open the day view for 2026-10-19
    And I expand the task list "Clean bathroom"
    And I edit the task list details
    And I fill in the task list form with:
      | title    | Bathroom |
      | estimate | 20       |
    And I save the task list
    And I choose "This and all following task lists" for the change
    Then the task list dialog is closed
    When I open the week view for 2026-10-26
    Then I see the task list "Bathroom" on 2026-10-26
    And the task list "Bathroom" has no estimate
    When I open the week view for 2026-10-19
    Then the task list "Bathroom" shows the estimate "~20 min"
    When I open the week view for 2026-10-12
    Then I see the task list "Clean bathroom" on 2026-10-12

  Scenario: Item lines changed in the task list form ask as well
    When I open the day view for 2026-10-19
    And I expand the task list "Clean bathroom"
    And I edit the task list details
    And I fill in the task list form with:
      | items | Sink; Floor; Mirror |
    And I save the task list
    Then I am asked whether to change "This task list" or "This and all following task lists"
    When I choose "This task list" for the change
    Then the task list dialog is closed
    When I expand the task list "Clean bathroom"
    Then the expanded task list items are "Sink, Floor, Mirror"
    When I open the week view for 2026-10-26
    Then the collapsed task list "Clean bathroom" lists the items "Sink, Floor"

  Scenario: Item lines removed in the task list form for this and all following lists reach the later ones
    When I open the day view for 2026-10-19
    And I expand the task list "Clean bathroom"
    And I edit the task list details
    And I fill in the task list form with:
      | items | Sink |
    And I save the task list
    And I choose "This and all following task lists" for the change
    Then the task list dialog is closed
    When I open the week view for 2026-10-26
    Then the collapsed task list "Clean bathroom" lists the items "Sink"
    When I open the week view for 2026-10-12
    Then the collapsed task list "Clean bathroom" lists the items "Sink, Floor"

  Scenario: The task list form shows how a list repeats
    When I open the day view for 2026-10-19
    And I expand the task list "Clean bathroom"
    And I edit the task list details
    Then the task list form shows:
      | repeat | Weekly |

  # Changing how a list repeats mirrors Google's recurring events (Calendar Help "Create a recurring event"): the
  # question offers "This and following" (not on the first one) and "All", never "This event", because one list cannot
  # repeat differently from the rest. Single lists changed one by one after the change point are dropped (the app says so
  # first; Google only warns that they can be lost).
  Scenario: Changing how a repeating list repeats asks for this and all following lists or all lists
    When I open the day view for 2026-10-19
    And I expand the task list "Clean bathroom"
    And I edit the task list details
    And I fill in the task list form with:
      | repeat | Daily |
    And I save the task list
    Then I am asked whether to change "This and all following task lists" or "All task lists"
    And "This and all following task lists" is chosen

  Scenario: This and all following lists start the new rhythm with this one and leave earlier lists alone
    When I open the day view for 2026-10-19
    And I expand the task list "Clean bathroom"
    And I edit the task list details
    And I fill in the task list form with:
      | repeat | Daily |
    And I save the task list
    And I choose "This and all following task lists" for the change
    And I open the week view for 2026-10-19
    Then I see the task list "Clean bathroom" on 2026-10-19
    And I see the task list "Clean bathroom" on 2026-10-20
    And I see the task list "Clean bathroom" on 2026-10-25
    When I open the week view for 2026-10-12
    Then I see the task list "Clean bathroom" on 2026-10-12
    And I do not see the task list "Clean bathroom" on 2026-10-13

  Scenario: All lists change the rhythm of the whole series
    When I open the day view for 2026-10-19
    And I expand the task list "Clean bathroom"
    And I edit the task list details
    And I fill in the task list form with:
      | repeat | Daily |
    And I save the task list
    And I choose "All task lists" for the change
    And I open the week view for 2026-10-12
    Then I see the task list "Clean bathroom" on 2026-10-13
    And I see the task list "Clean bathroom" on 2026-10-18

  Scenario: The first list can only change all lists
    When I open the day view for 2026-10-12
    And I expand the task list "Clean bathroom"
    And I edit the task list details
    And I fill in the task list form with:
      | repeat | Daily |
    And I save the task list
    Then I am asked only whether to change "All task lists"

  Scenario: A list that no longer repeats from here on can only change this and all following lists
    When I open the day view for 2026-10-19
    And I expand the task list "Clean bathroom"
    And I edit the task list details
    And I fill in the task list form with:
      | repeat | Does not repeat |
    And I save the task list
    Then I am asked only whether to change "This and all following task lists"
    When I choose "This and all following task lists" for the change
    And I open the week view for 2026-10-19
    Then I see exactly one task list "Clean bathroom" on 2026-10-19
    When I open the week view for 2026-10-26
    Then I do not see the task list "Clean bathroom"
    When I open the week view for 2026-10-12
    Then I see the task list "Clean bathroom" on 2026-10-12

  Scenario: A list changed on its own after this one is dropped, and the question says so first
    Given "Floor" of "Clean bathroom" was ticked on 2026-10-26
    When I open the day view for 2026-10-19
    And I expand the task list "Clean bathroom"
    And I edit the task list details
    And I fill in the task list form with:
      | repeat | Daily |
    And I save the task list
    Then the change question warns that lists changed on their own will be lost
    When I choose "This and all following task lists" for the change
    And I open the week view for 2026-10-26
    Then the task list "Clean bathroom" shows the done count "0/2"

  Scenario: A list changed on its own before this one is kept
    Given "Floor" of "Clean bathroom" was ticked on 2026-10-12
    When I open the day view for 2026-10-19
    And I expand the task list "Clean bathroom"
    And I edit the task list details
    And I fill in the task list form with:
      | repeat | Daily |
    And I save the task list
    Then the change question has no warning
    When I choose "This and all following task lists" for the change
    And I open the week view for 2026-10-12
    Then the task list "Clean bathroom" shows the done count "1/2"

  Scenario: Cancelling the question about the rhythm changes nothing
    When I open the day view for 2026-10-19
    And I expand the task list "Clean bathroom"
    And I edit the task list details
    And I fill in the task list form with:
      | repeat | Daily |
    And I save the task list
    And I cancel the choice
    And I cancel the task list dialog
    And I open the week view for 2026-10-19
    Then I do not see the task list "Clean bathroom" on 2026-10-20

  Scenario: Ticking an item of a repeating list never asks
    When I open the day view for 2026-10-19
    And I expand the task list "Clean bathroom"
    And I tick the item "Sink"
    Then the task list "Clean bathroom" shows the done count "1/2"
    And I am not asked which task lists to change

  Scenario: A list that does not repeat never asks
    Given the calendar contains a task list "Groceries" on 2026-10-14 with items:
      | item | done |
      | Milk | no   |
    When I open the day view for 2026-10-14
    And I expand the task list "Groceries"
    And I add the item "Eggs"
    Then the expanded task list items are "Milk, Eggs"
    And I am not asked which task lists to change
