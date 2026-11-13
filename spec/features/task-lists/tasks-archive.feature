@tasklists @tasks-archive @id:tasks-archive
Feature: The Archive keeps finished task lists
  The Tasks view has two tabs, Open and Archive. A task list is archived automatically once all its items are
  ticked; there is no archive button. The Archive shows finished lists, newest first (by the day they were finished),
  and its search matches a list's title and its items' titles. Unticking an item of an archived list opens it again;
  "Copy" makes an open copy of a list without a date and with every item open (owner 2026-10-25: renamed from "Use as
  template", so "template" only means the saved templates of feature tasklist-templates). The setting "Finished list without a date"
  decides whether a list that was finished without a date shows in the calendar on that day (default) or only in the
  Archive. Dated finished lists always stay in the calendar on their day: the Archive is only a view.

  Background:
    Given the calendar is empty
    And today is 2026-10-12

  Scenario: A finished list moves to the Archive
    Given the calendar contains an undated task list "Taxes" with items:
      | item | done |
      | Form | no   |
    When I tick the item "Form" of the task list "Taxes" in the Tasks view
    Then the Archive lists "Taxes"
    And the Open tab does not list "Taxes"

  Scenario: The Archive lists the newest finished list first
    Given the calendar contains a task list "Old" finished on 2026-10-08
    And the calendar contains a task list "Newer" finished on 2026-10-10
    When I open the Archive
    Then the Archive lists "Newer, Old"

  Scenario: The Archive search finds a list by one of its items
    Given the calendar contains a task list "Trip" finished on 2026-10-09 with the item "Passport"
    And the calendar contains a task list "Taxes" finished on 2026-10-10 with the item "Form"
    When I search the Archive for "passp"
    Then the Archive lists "Trip"

  Scenario: The Archive search is the same search bar as in the settings
    When I search the Archive for "a"
    Then the Archive search bar is full round and 56 px high

  Scenario: Unticking an item restores a list to Open
    Given the calendar contains a task list "Taxes" finished on 2026-10-10 with the item "Form"
    When I untick the item "Form" of the task list "Taxes" in the Archive
    Then the Archive does not list "Taxes"
    And the Open tab lists "Taxes"

  Scenario: Copy creates an open undated copy
    Given the calendar contains a task list "Packing" finished on 2026-10-10 with the item "Passport"
    When I choose "Copy" for the task list "Packing" in the Archive
    Then the Open tab lists "Packing"
    And the open task list "Packing" has no date and 1 open item
    And the Archive lists "Packing"

  Scenario: A finished undated list shows on the finished day by default
    Given the calendar contains an undated task list "Taxes" with items:
      | item | done |
      | Form | no   |
    When I tick the item "Form" of the task list "Taxes" in the Tasks view
    Then the calendar shows the task list "Taxes" on 2026-10-12
    And the Archive lists "Taxes"

  Scenario: Archive only keeps a finished undated list out of the calendar
    Given the setting "Finished list without a date" is "Archive only"
    And the calendar contains an undated task list "Taxes" with items:
      | item | done |
      | Form | no   |
    When I tick the item "Form" of the task list "Taxes" in the Tasks view
    Then the Archive lists "Taxes"
    And neither the calendar on 2026-10-12 nor the open tasks tray shows the task list "Taxes"
