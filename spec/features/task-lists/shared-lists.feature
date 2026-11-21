@sharing @id:shared-lists @area:tasklists
Feature: Sharing task lists with another person
  A person shares a task list by typing the email address of another person, or shares a whole category the same
  way. Sharing sends an invitation: nothing is shared, and nothing about the other person is revealed, until that
  person accepts it (ADR 0047). The app never lists everybody who uses it: the field offers only people who accepted
  a share of the person and people who share lists with them (ADR 0046). A shared list lives on the server, not in
  Google: accepting moves it out of the owner's tasks calendar, taking the last person off it (removing them, or the last one leaving) moves it back. Both people see and edit it everywhere task lists appear and it carries a
  small "shared" badge with the other person's initial. Only the owner can delete it for everyone; the other person
  can leave it, which removes it for them only. Changes of the other person show up on the next automatic sync, and
  an edit based on an outdated version is refused with the usual conflict message.

  Background:
    Given today is 2026-10-12
    And "jo@example.com", "anna@example.com" and "bob@example.com" may use the calendar

  Scenario: Sharing a list shows it to the other person
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk, Eggs"
    And "jo@example.com" is signed in
    When I share the task list "Groceries" with "anna@example.com" who accepts
    And "anna@example.com" opens the Tasks view on another device
    Then the Open tab lists "Groceries"
    And the task list "Groceries" in the Tasks view is shared with "J"

  Scenario: The other person ticks an item and the owner sees it after the sync
    Given automatic sync runs every 2 seconds
    And "jo@example.com" has an undated task list "Groceries" with the items "Milk, Eggs"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com" who accepts
    When "anna@example.com" ticks the item "Milk" of the shared task list "Groceries"
    And I wait for the automatic sync
    Then the item "Milk" of the task list "Groceries" in the Tasks view is ticked

  Scenario: Removing the person moves the list back to the owner only
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk, Eggs"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com" who accepts
    When I stop sharing the task list "Groceries"
    Then "anna@example.com" sees no task lists
    And "jo@example.com" sees the task lists "Groceries"

  Scenario: The other person can leave a shared list
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk, Eggs"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com" who accepts
    When "anna@example.com" leaves the shared task list "Groceries"
    Then "anna@example.com" sees no task lists
    And "jo@example.com" sees the task lists "Groceries"
    And "jo@example.com" has the task list "Groceries" to themselves again

  Scenario: A stranger cannot read a shared list
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk, Eggs"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com" who accepts
    Then "bob@example.com" cannot read the shared task list "Groceries"

  @conflict
  Scenario: Editing a shared list that the other person changed in the meantime, the last change wins (ADR 0031)
    Given automatic sync is disabled
    And the live connection is blocked
    And "jo@example.com" has an undated task list "Groceries" with the items "Milk, Eggs"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com" who accepts
    And I reload the page
    And the task list "Groceries" in the Tasks view is shared with "A"
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
    And I share the task list "Groceries" with "anna@example.com" who accepts
    When "anna@example.com" opens the Tasks view on another device
    Then the task list "Groceries" in the Tasks view shows the category "Shopping"

  Scenario: The other person cannot change a shared list's category
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk" in the category "Shopping"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com" who accepts
    When "anna@example.com" edits the shared task list "Groceries"
    Then "anna@example.com" is not offered to change the category

  Scenario: The owner deletes a shared list for everyone
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk, Eggs"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com" who accepts
    When I delete the shared task list "Groceries"
    Then "anna@example.com" sees no task lists

  Scenario: The other person can leave a shared list but not delete it
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk, Eggs"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com" who accepts
    When "anna@example.com" edits the shared task list "Groceries"
    Then "anna@example.com" is offered to leave the list, not to delete it

  Scenario: Sharing by typing the address of the other person
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "jo@example.com" is signed in
    When I open "Share with" for the task list "Groceries"
    Then "Share with" is an email field
    And "Share with" offers no addresses

  Scenario: An address that was shared with is offered again, to the person who shared it
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "jo@example.com" has an undated task list "Errands" with the items "Post"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com" who accepts
    When I open "Share with" for the task list "Errands"
    Then "Share with" offers only "anna@example.com"
    And "bob@example.com" is offered no address to share with

  Scenario: A person who shared a list with you is offered to you
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "jo@example.com" is signed in
    When I share the task list "Groceries" with "anna@example.com" who accepts
    Then "anna@example.com" is offered only "jo@example.com" to share with

  # unit: server/test/invitations.test.ts:answers a known, an unknown and a removed address the same way
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
    And I share the task list "Groceries" with "anna@example.com" who accepts
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

  # Invitation to accept (issue 183, ADR 0047): sharing only sends an invitation. Nothing is revealed and nothing is
  # shared until the other person accepts. The note under the field is the same for every address.

  Scenario Outline: Sharing sends an invitation and shares nothing yet
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "jo@example.com" is signed in
    When I try to share the task list "Groceries" with "<address>"
    Then the sharing field says "Invitation sent to <address>"
    And the task list "Groceries" in the Tasks view is not shared
    And "anna@example.com" sees no task lists

    Examples:
      | address              |
      | anna@example.com     |
      | stranger@example.com |

  Scenario: The sharer sees the pending invitation and can withdraw it
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "jo@example.com" is signed in
    And I try to share the task list "Groceries" with "anna@example.com"
    When I edit the task list "Groceries" in the Tasks view
    Then the sharing line says "Invitation sent to anna@example.com"
    When I withdraw the invitation to share the task list "Groceries"
    Then the task list "Groceries" in the Tasks view is not shared
    And "anna@example.com" sees no invitations

  Scenario: The invited person sees the invitation in the Tasks view
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com"
    When "anna@example.com" opens the Tasks view on another device
    Then the Tasks view shows the invitation to the task list "Groceries" from "jo@example.com"
    And the Open tab does not list "Groceries"

  Scenario: Accepting an invitation shares the list both ways
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk, Eggs"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com"
    When "anna@example.com" accepts the invitation to the task list "Groceries"
    Then "anna@example.com" sees the task lists "Groceries"
    And "anna@example.com" sees no invitations
    And "jo@example.com" sees the task lists "Groceries"
    When I edit the task list "Groceries" in the Tasks view
    Then the sharing line says "Shared with anna"

  Scenario: Declining an invitation shares nothing and tells the sharer nothing new
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com"
    When "anna@example.com" declines the invitation to the task list "Groceries"
    Then "anna@example.com" sees no task lists
    And "anna@example.com" sees no invitations
    And the task list "Groceries" in the Tasks view is not shared
    When I edit the task list "Groceries" in the Tasks view
    Then the sharing line says "Invitation sent to anna@example.com"

  Scenario: After a decline the sharer can invite the same address again, which shows as a new card
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com"
    And "anna@example.com" declines the invitation to the task list "Groceries"
    When I share the task list "Groceries" with "anna@example.com"
    And "anna@example.com" opens the Tasks view on another device
    Then the Tasks view shows the invitation to the task list "Groceries" from "jo@example.com"
    When "anna@example.com" accepts the invitation to the task list "Groceries"
    Then "anna@example.com" sees the task lists "Groceries"
    And "jo@example.com" sees the task lists "Groceries"

  Scenario: Inviting again tells the sharer nothing about the decline
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com"
    And "anna@example.com" declines the invitation to the task list "Groceries"
    When I share the task list "Groceries" with "anna@example.com"
    And I edit the task list "Groceries" in the Tasks view
    Then the sharing lines say "Invitation sent to anna@example.com"

  Scenario: Only the invited person can answer an invitation
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com"
    Then "bob@example.com" cannot accept the invitation to the task list "Groceries"

  Scenario: Sharing a category sends one invitation, and accepting shares its lists and the new ones
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk" in the category "Shopping"
    And "jo@example.com" is signed in
    When I share the category "Shopping" with "anna@example.com" in the settings
    Then "anna@example.com" sees no task lists
    When "anna@example.com" opens the Tasks view on another device
    Then the Tasks view shows the invitation to the category "Shopping" from "jo@example.com"
    When "anna@example.com" accepts the invitation to the category "Shopping"
    And "jo@example.com" creates the undated task list "Party snacks" in the category "Shopping"
    Then "anna@example.com" sees the task lists "Groceries, Party snacks"

  Scenario: The sharer sees a pending category invitation and can withdraw it
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk" in the category "Shopping"
    And "jo@example.com" is signed in
    And I share the category "Shopping" with "anna@example.com" in the settings
    When I open the category "Shopping" in the settings
    Then the sharing field says "Invitation sent to anna@example.com"
    When I withdraw the invitation to share the category "Shopping" in the settings
    Then "anna@example.com" sees no invitations

  Scenario: The invited person is told of an invitation by a snackbar that shows it
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com"
    When "anna@example.com" opens the Tasks view on another device
    Then a snackbar says "jo@example.com invites you to share “Groceries”"
    When I press "Show" in the snackbar
    Then the Tasks view shows the invitation to the task list "Groceries" from "jo@example.com"

  Scenario: An invitation that nobody answers expires after 7 days
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com"
    When the time is 2026-10-20 08:00
    Then "anna@example.com" sees no invitations
    When I edit the task list "Groceries" in the Tasks view
    Then "Share with" is an email field

  Scenario: An invitation to an address that has not signed in yet is kept until the first sign-in
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "newcomer@example.com" may use the calendar but has not signed in yet
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "newcomer@example.com"
    When "newcomer@example.com" opens the Tasks view on another device
    Then the Tasks view shows the invitation to the task list "Groceries" from "jo@example.com"

  # unit: server/test/invitations.test.ts:answers a known, an unknown and a removed address the same way
  # unit: server/test/invitations.test.ts:holds every answer, known address or not, for the minimum time
  # unit: server/test/invitations.test.ts:writes nothing personal to the log
  @unit
  Scenario: The server does not tell whether an address uses the calendar
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    When "jo@example.com" shares the task list "Groceries" with "anna@example.com" and with "stranger@example.com"
    Then both answers have the same status, the same body shape and the same minimum duration

  # unit: web/test/invitations.test.ts:shows the invitations the device copy holds while offline
  @unit
  Scenario: The invitations are on the device and shown without a connection
    Given the device holds the invitation to the task list "Groceries" from "jo@example.com"
    When the device is offline
    Then the Tasks view shows the invitation to the task list "Groceries" from "jo@example.com"

  @visual @mobile
  Scenario Outline: The invitation card and its snackbar look right in light and dark
    Given the device prefers a <scheme> color scheme
    And "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com"
    When "anna@example.com" opens the Tasks view on another device
    Then the "invitation snackbar" still looks like "invitation-snackbar-<scheme>"
    And the "invitation card" still looks like "invitation-card-<scheme>"

    Examples:
      | scheme |
      | light  |
      | dark   |

  @visual @mobile
  Scenario Outline: The sender's pending invitation looks right in light and dark
    Given the device prefers a <scheme> color scheme
    And "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com"
    When I edit the task list "Groceries" in the Tasks view
    Then the "list form" still looks like "invitation-pending-<scheme>"

    Examples:
      | scheme |
      | light  |
      | dark   |

  @visual @mobile
  Scenario Outline: The invitation card sits above the lists of the Tasks view in light and dark
    Given the device prefers a <scheme> color scheme
    And "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "anna@example.com" has an undated task list "Errands" with the items "Post"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com"
    When "anna@example.com" opens the Tasks view on another device
    Then the "tasks view" still looks like "invitation-tasks-view-<scheme>"

    Examples:
      | scheme |
      | light  |
      | dark   |

  # Sharing from the opened list (issue 27). "Share" is an entry of the list's overflow menu (three dots) for the owner;
  # it opens the list's form at "Share with". The field stays open for another person, every sent invitation and every
  # accepted person has a line of its own (Withdraw, or Remove, which takes only that person off; the last one stops sharing), and a person the list is shared with only reads who it is shared by. Sharing a
  # category stays with one person. Declining answers only that one invitation: the sharer can invite the same address again
  # (a new card) and is still told nothing of the decline.

  Scenario: The owner finds Share in the overflow menu, a member does not
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "jo@example.com" is signed in
    When I open the Tasks view
    And I open the overflow menu of the task list "Groceries"
    Then the overflow menu lists "Edit, Duplicate, Share, Archive, Save as template, Delete"
    When I share the task list "Groceries" with "anna@example.com" who accepts
    And "anna@example.com" opens the Tasks view on another device
    And I open the overflow menu of the task list "Groceries"
    Then the overflow menu lists "Edit, Duplicate, Archive, Save as template, Leave"

  Scenario: Share opens the list's form at "Share with"
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "jo@example.com" is signed in
    When I open the Tasks view
    And I choose "Share" in the overflow menu of the task list "Groceries"
    Then the task list form is open at "Share with"

  Scenario: Another person can be added to a list that is already shared
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com" who accepts
    When I share the task list "Groceries" with "bob@example.com"
    And I edit the task list "Groceries" in the Tasks view
    Then the sharing lines say "Shared with anna, Invitation sent to bob@example.com"
    And "Share with" is an email field

  Scenario: Two invitations wait side by side and one can be withdrawn
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com"
    And I share the task list "Groceries" with "bob@example.com"
    When I edit the task list "Groceries" in the Tasks view
    Then the sharing lines say "Invitation sent to anna@example.com, Invitation sent to bob@example.com"
    When I withdraw the invitation to "bob@example.com" for the task list "Groceries"
    Then "bob@example.com" sees no invitations
    And "anna@example.com" is invited to the task list "Groceries"

  Scenario: Two people who accepted both see the list
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com" who accepts
    And I share the task list "Groceries" with "bob@example.com" who accepts
    Then "anna@example.com" sees the task lists "Groceries"
    And "bob@example.com" sees the task lists "Groceries"
    When I edit the task list "Groceries" in the Tasks view
    Then the sharing lines say "Shared with anna, Shared with bob"

  Scenario: A member only reads who the list is shared by and with
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com" who accepts
    And I share the task list "Groceries" with "bob@example.com" who accepts
    When "anna@example.com" edits the shared task list "Groceries"
    Then the sharing lines say "Shared by jo, Also shared with bob"
    And "Share with" is not offered

  Scenario: Removing one of two people keeps the list shared with the other
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com" who accepts
    And I share the task list "Groceries" with "bob@example.com" who accepts
    When I remove "anna" from the task list "Groceries"
    Then the sharing lines say "Shared with bob"
    And "anna@example.com" sees no task lists
    And "bob@example.com" sees the task lists "Groceries"

  Scenario: Removing the last person stops sharing
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com" who accepts
    When I remove "anna" from the task list "Groceries"
    Then "anna@example.com" sees no task lists
    And "jo@example.com" sees the task lists "Groceries"
    When I open "Share with" for the task list "Groceries"
    Then "Share with" is an email field

  # Removal wins (issue 27): a person taken off one list of a shared category stays off that list; the category stays
  # shared, its other lists stay shared, and lists created in it later reach the person.
  Scenario: A person removed from one list of a shared category stays off it, the other lists stay shared
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk" in the category "Shopping"
    And "jo@example.com" has an undated task list "Party snacks" with the items "Chips" in the category "Shopping"
    And "jo@example.com" is signed in
    And I share the category "Shopping" with "anna@example.com" in the settings
    And "anna@example.com" accepts the invitation to the category "Shopping"
    When I remove "anna" from the task list "Groceries"
    Then "anna@example.com" sees the task lists "Party snacks"
    And "jo@example.com" sees the task lists "Groceries, Party snacks"

  Scenario: A list created in the category after a removal still reaches the person
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk" in the category "Shopping"
    And "jo@example.com" is signed in
    And I share the category "Shopping" with "anna@example.com" in the settings
    And "anna@example.com" accepts the invitation to the category "Shopping"
    And I remove "anna" from the task list "Groceries"
    When "jo@example.com" creates the undated task list "Party snacks" in the category "Shopping"
    Then "anna@example.com" sees the task lists "Party snacks"

  Scenario: Stopping the category share ends the removal, and a new share includes the list again
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk" in the category "Shopping"
    And "jo@example.com" has an undated task list "Party snacks" with the items "Chips" in the category "Shopping"
    And "jo@example.com" is signed in
    And I share the category "Shopping" with "anna@example.com" in the settings
    And "anna@example.com" accepts the invitation to the category "Shopping"
    And I remove "anna" from the task list "Groceries"
    When I stop sharing the category "Shopping" in the settings
    And I share the category "Shopping" with "anna@example.com" in the settings
    And "anna@example.com" accepts the invitation to the category "Shopping"
    Then "anna@example.com" sees the task lists "Groceries, Party snacks"

  # unit: server/test/shared-lists.test.ts:is not undone when the category invitation is accepted again
  @unit
  Scenario: Accepting the category invitation again does not bring a removed person back
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk" in the category "Shopping"
    And "jo@example.com" has an undated task list "Party snacks" with the items "Chips" in the category "Shopping"
    And "jo@example.com" is signed in
    And I share the category "Shopping" with "anna@example.com" in the settings
    And "anna@example.com" accepts the invitation to the category "Shopping"
    And I remove "anna" from the task list "Groceries"
    When "anna@example.com" accepts the invitation to the category "Shopping" again
    Then "anna@example.com" sees the task lists "Party snacks"

  # unit: server/test/shared-lists.test.ts:ends for that list when the person is added to it by hand
  @unit
  Scenario: Adding the removed person to that one list by hand brings the category's share back to it
    Given "jo@example.com" has an undated task list "Groceries" with the items "Milk" in the category "Shopping"
    And "jo@example.com" is signed in
    And I share the category "Shopping" with "anna@example.com" in the settings
    And "anna@example.com" accepts the invitation to the category "Shopping"
    And I remove "anna" from the task list "Groceries"
    When I share the task list "Groceries" with "anna@example.com" who accepts
    And "anna@example.com" accepts the invitation to the category "Shopping" again
    Then "anna@example.com" sees the task lists "Groceries"

  @visual @mobile
  Scenario Outline: The overflow menu with Share looks right in light and dark
    Given the device prefers a <scheme> color scheme
    And "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "jo@example.com" is signed in
    When I open the Tasks view
    And I open the overflow menu of the task list "Groceries"
    Then the "overflow menu" still looks like "share-menu-<scheme>"

    Examples:
      | scheme |
      | light  |
      | dark   |

  @visual @mobile
  Scenario Outline: The form of a list shared with one person and invited another looks right in light and dark
    Given the device prefers a <scheme> color scheme
    And "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com" who accepts
    And I share the task list "Groceries" with "bob@example.com"
    When I edit the task list "Groceries" in the Tasks view
    Then the "list form" still looks like "share-two-people-<scheme>"

    Examples:
      | scheme |
      | light  |
      | dark   |

  @visual @mobile
  Scenario Outline: A member's form shows who the list is shared by in light and dark
    Given the device prefers a <scheme> color scheme
    And "jo@example.com" has an undated task list "Groceries" with the items "Milk"
    And "jo@example.com" is signed in
    And I share the task list "Groceries" with "anna@example.com" who accepts
    And I share the task list "Groceries" with "bob@example.com" who accepts
    When "anna@example.com" edits the shared task list "Groceries"
    Then the "list form" still looks like "share-member-<scheme>"

    Examples:
      | scheme |
      | light  |
      | dark   |
