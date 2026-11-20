@sharing @id:shared-lists
Feature: Sharing task lists with another person
  A person shares a task list by typing the email address of another person who may use the calendar, or shares a
  whole category the same way. The app never lists everybody who uses it: the field offers only addresses the person
  typed before and people who share lists with them (ADR 0046). A shared list lives on the server, not in Google: sharing moves it out of the owner's tasks
  calendar, "Stop sharing" moves it back. Both people see and edit it everywhere task lists appear and it carries a
  small "shared" badge with the other person's initial. Only the owner can delete it for everyone; the other person
  can leave it, which removes it for them only. Changes of the other person show up on the next automatic sync, and
  an edit based on an outdated version is refused with the usual conflict message.

  Background:
    Given today is 2026-10-12
    And "jo@example.com", "anna@example.com" and "bob@example.com" may use the calendar

  Scenario: Sharing a list shows it to the other person
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk, Eggs"
    And "jo@example.com" is signed in
    When I share the task list "Groceries" with "anna@example.com"
    And "anna@example.com" opens the Tasks view on another device
    Then the Open tab lists "Groceries"
    And the task list "Groceries" in the Tasks view is shared with "J"

  Scenario: The other person ticks an item and the owner sees it after the sync
    Given automatic sync runs every 2 seconds
    And "jo@example.com" has an undated task list "Groceries" with the items "Milk, Eggs"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com"
    When "anna@example.com" ticks the item "Milk" of the shared task list "Groceries"
    And I wait for the automatic sync
    Then the item "Milk" of the task list "Groceries" in the Tasks view is ticked

  Scenario: Stop sharing moves the list back to the owner only
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk, Eggs"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com"
    When I stop sharing the task list "Groceries"
    Then "anna@example.com" sees no task lists
    And "jo@example.com" sees the task lists "Groceries"

  Scenario: Sharing a category shares its lists and the new ones
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk" in the category "Shopping"
    And "jo@example.com" is signed in
    When I share the category "Shopping" with "anna@example.com" in the settings
    And "jo@example.com" creates the undated task list "Party snacks" in the category "Shopping"
    Then "anna@example.com" sees the task lists "Groceries, Party snacks"

  Scenario: The other person can leave a shared list
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk, Eggs"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com"
    When "anna@example.com" leaves the shared task list "Groceries"
    Then "anna@example.com" sees no task lists
    And "jo@example.com" sees the task lists "Groceries"

  Scenario: A stranger cannot read a shared list
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk, Eggs"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com"
    Then "bob@example.com" cannot read the shared task list "Groceries"

  @conflict
  Scenario: Editing a shared list that the other person changed in the meantime, the last change wins (ADR 0031)
    Given automatic sync is disabled
    And the live connection is blocked
    And "jo@example.com" has an undated task list "Groceries" with the items "Milk, Eggs"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com"
    When "anna@example.com" renames the shared task list "Groceries" to "Weekly shop"
    And I edit the task list "Groceries" in the Tasks view
    And I fill in the task list form with:
      | title | Food |
    And I save the task list
    Then the task list dialog is closed
    And "anna@example.com" sees the task lists "Food"
    And the card of the task list "Food" in the Tasks view shows the items "Milk, Eggs"

  Scenario: Everyone sees the owner's category on a shared list
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk" in the category "Shopping"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com"
    When "anna@example.com" opens the Tasks view on another device
    Then the task list "Groceries" in the Tasks view shows the category "Shopping"

  Scenario: The other person cannot change a shared list's category
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk" in the category "Shopping"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com"
    When "anna@example.com" edits the shared task list "Groceries"
    Then "anna@example.com" is not offered to change the category

  Scenario: The owner deletes a shared list for everyone
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk, Eggs"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com"
    When I delete the shared task list "Groceries"
    Then "anna@example.com" sees no task lists

  Scenario: The other person can leave a shared list but not delete it
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk, Eggs"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com"
    When "anna@example.com" edits the shared task list "Groceries"
    Then "anna@example.com" is offered to leave the list, not to delete it

  Scenario: Sharing by typing the address of the other person
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "jo@example.com" is signed in
    When I open "Share with" for the task list "Groceries"
    Then "Share with" is an email field
    And "Share with" offers no addresses

  Scenario: An address that was typed before is offered again, to the person who typed it
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "jo@example.com" has an undated task list "Errands" with the items "Post"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com"
    When I open "Share with" for the task list "Errands"
    Then "Share with" offers only "anna@example.com"
    And "bob@example.com" is offered no address to share with

  Scenario: A person who shared a list with you is offered to you
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "jo@example.com" is signed in
    When I share the task list "Groceries" with "anna@example.com"
    Then "anna@example.com" is offered only "jo@example.com" to share with

  Scenario: The address of somebody who does not use the calendar gets a neutral message and shares nothing
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "jo@example.com" is signed in
    When I try to share the task list "Groceries" with "stranger@example.com"
    Then the sharing field says "If this person uses the calendar, they'll see the list."
    And "Share with" offers no addresses
    And the task list "Groceries" in the Tasks view is not shared
    And "anna@example.com" sees no task lists

  # unit: server/test/share-by-address.test.ts:answers an address that is not an allowed person like a success that shared nobody
  # unit: server/test/share-by-address.test.ts:GET /api/people offers only the contacts of the person asking
  # unit: server/test/share-by-address.test.ts:signing in is not announced to anybody
  # unit: server/test/share-by-address.test.ts:carries the same scoped people in the change feed
  @unit
  Scenario: Nobody else's address is shown, and the answer for an unknown address does not tell it apart
    Given "jo@example.com", "anna@example.com" and "bob@example.com" may use the calendar
    Then "jo@example.com" is offered no address to share with

  # unit: web/test/share-people.test.ts:offers the addresses the device copy holds while offline
  @unit
  Scenario: The known addresses are on the device and offered without a connection
    Given the device holds the address "anna@example.com" for sharing
    When the device is offline
    Then "Share with" offers only "anna@example.com"

  Scenario: A list shared before keeps saying who it is shared with and by
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com"
    When I edit the task list "Groceries" in the Tasks view
    Then the sharing line says "Shared with anna"
    When "anna@example.com" edits the shared task list "Groceries"
    Then the sharing line says "Shared by jo"

  # The next scenarios describe built behaviour about files on the server, which the browser suite cannot reach, so they
  # are tagged @unit and name their unit test.

  # unit: server/test/hardening-shared.test.ts:skips (and logs) invalid files so every other list still loads
  # unit: server/test/hardening-shared.test.ts:rejects %s
  @unit
  Scenario Outline: A damaged shared list file is skipped and the other lists still load
    Given "jo@example.com" shares the task list "Groceries" with "anna@example.com"
    And a second shared list file on the server is damaged because <damage>
    When the server starts
    Then "anna@example.com" sees the task lists "Groceries"
    And "jo@example.com" sees the task lists "Groceries"
    And the damaged file is left out and noted in the server log

    Examples:
      | damage                                   |
      | "its list of members is missing"         |
      | "its list of members holds a non-name"   |
      | "it has no owner"                        |
      | "its version number is not a number"     |
      | "its content is missing"                 |
      | "its items are not a list"               |
      | "it is of an unknown format version"     |

  # unit: server/test/hardening-shared.test.ts:writes a valid list and skips (and logs) invalid ones
  @unit
  Scenario: A restore from Drive skips shared lists that are not valid
    Given the Drive backup of "jo@example.com" holds the shared list "Groceries" and one damaged shared list
    When "jo@example.com" restores from the Drive backup
    Then the shared list "Groceries" is back
    And the damaged shared list is left out and noted in the server log
