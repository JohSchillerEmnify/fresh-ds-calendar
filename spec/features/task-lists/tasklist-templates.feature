@tasklists @templates @id:tasklist-templates
Feature: Task list templates
  Some lists are done the same way again and again (packing, cleaning, a weekly shop). Any task list can be saved as a
  template, also a finished one, and a new list can be saved as a template while it is created (owner, 2026-10-25).
  A new task list can then start from a template: the form is filled with the template's items and the rest (date,
  time, repeat, reminders) is set as for any new list (owner: "you can then set time and stuff").
  UI (owner, design canvas 2026-10-25): "Save as template" is a tonal pill in the list's footer after "Add item" and
  before Edit and Delete; it opens a small dialog with the name (prefilled with the title), the items and Cancel/Save.
  The create form has a "From template ▾" pill next to its heading; a tap grows the pill in place into a panel whose
  top row is the pill itself ("From template ▴" where the pill was), then the templates ("2 items · ~45 min · Home"
  under each name), a divider and "Manage templates"; after a pick the pill shows the template's name. "Also save as template" is a switch row right above Cancel and Save.
  The Archive keeps its one-off copy, renamed "Copy" so "template" only means these templates, and gets "Save as
  template" next to it (owner).
  A template keeps a name, its items in their order (always unticked), the estimate and the category. It never keeps
  a date, a time, a repeat, reminders, tags, sharing or ticks: those belong to one list, not to the routine.
  Templates are managed in Settings → Task lists → Templates, a row in the Task lists card that opens a sub page (owner: "we need some way of managing those templates"):
  see them all, make a new one there ("New template" on top of the list and in the empty state, owner), rename,
  change the items (add, remove, reorder, retitle), estimate and category, delete with undo.
  The template picker links there too. Templates belong to the person and follow them to every device; they are
  stored by the app server per person (like prefs and own themes), not in Google, so they never show as events.
  Like the rest of the person's data they are also kept on the device (feature last-known-state; owner, 2026-10-25:
  "Everything should be stored on device and only synced from the server"): they show at once from the device and
  are refreshed from the server; without a connection they can be used but not changed.
  Changing or deleting a template never changes lists already made from it.

  Background:
    Given the calendar is empty
    And today is 2026-10-12

  Rule: A task list can be saved as a template

    Scenario: Save an open task list as a template
      Given the calendar contains a task list "Packing" on 2026-10-14 with items:
        | item       | done |
        | Passport   | yes  |
        | Charger    | no   |
        | Toothbrush | no   |
      When I open the day view for 2026-10-14
      And I expand the task list "Packing"
      Then the footer of the expanded task list shows "Add item, Save as template, Edit, Delete"
      When I save the task list as a template
      Then the template name field shows "Packing"
      And the template dialog previews the items "Passport, Charger, Toothbrush"
      When I confirm the template
      Then a snackbar says "Saved as template"
      And my templates are "Packing"
      And the template "Packing" has the items "Passport, Charger, Toothbrush"
      And the task list "Packing" shows the done count "1/3"

    Scenario: Save a finished task list from the Archive as a template, next to its one-off copy
      Given the calendar contains a task list "Packing" finished on 2026-10-10 with the item "Passport"
      When I open the Archive
      Then the task list "Packing" in the Archive offers "Copy" and "Save as template"
      When I choose "Save as template" for the task list "Packing" in the Archive
      And I confirm the template
      Then my templates are "Packing"
      And the template "Packing" has the items "Passport"
      And the Archive lists "Packing"
      And the Open tab does not list "Packing"

    Scenario: A template keeps the estimate and the category but not the date, time or ticks
      Given the calendar contains a task list "Clean bathroom" in the category "Home" on 2026-10-14 at 18:00 for 45 minutes with items:
        | item  | done |
        | Sink  | yes  |
        | Floor | no   |
      When I open the day view for 2026-10-14
      And I expand the task list "Clean bathroom"
      And I save the task list as a template
      And I confirm the template
      And I open the templates in the settings
      And I open the template "Clean bathroom"
      Then the template form shows:
        | name     | Clean bathroom |
        | items    | Sink; Floor    |
        | estimate | 45             |
        | category | Home           |
      And the template form has no date, time, repeat or reminder fields

    Scenario: The template can be given its own name
      Given the calendar contains a task list "Packing for Rome" on 2026-10-14 with items:
        | item     | done |
        | Passport | no   |
      When I open the day view for 2026-10-14
      And I expand the task list "Packing for Rome"
      And I save the task list as a template
      And I enter the template name "City trip"
      And I confirm the template
      Then my templates are "City trip"
      And I see the task list "Packing for Rome" on 2026-10-14

    @validation
    Scenario: A template needs a name when it is saved from a list
      Given the calendar contains a task list "Packing" on 2026-10-14 with items:
        | item     | done |
        | Passport | no   |
      When I open the day view for 2026-10-14
      And I expand the task list "Packing"
      And I save the task list as a template
      And I enter the template name ""
      And I confirm the template
      Then the template dialog shows the error "Give the template a name"
      And I have no templates

    @validation
    Scenario: A new titleless list cannot also be saved as a template
      When I open the day view for 2026-10-14
      And I start creating a task list
      And I fill in the task list form with:
        | date  | 2026-10-14 |
        | items | Milk; Eggs |
      And I turn on "Also save as template" in the task list form
      And I save the task list
      Then the task list dialog shows the error "Give the list a title to save it as a template"
      And the task list dialog is open
      And I have no templates

    @validation
    Scenario: Two templates cannot have the same name
      Given I have the template "Packing" with the items "Passport"
      And the calendar contains a task list "Packing" on 2026-10-14 with items:
        | item    | done |
        | Charger | no   |
      When I open the day view for 2026-10-14
      And I expand the task list "Packing"
      And I save the task list as a template
      And I confirm the template
      Then the template dialog shows the error "A template with this name already exists"
      And the template "Packing" has the items "Passport"

    Scenario: A new task list can be saved as a template while it is created
      When I open the week view for 2026-10-12
      And I start creating a task list
      And I fill in the task list form with:
        | title | Weekly shop       |
        | date  | 2026-10-14        |
        | items | Milk; Eggs; Bread |
      And I turn on "Also save as template" in the task list form
      And I save the task list
      Then I see the task list "Weekly shop" on 2026-10-14
      And my templates are "Weekly shop"
      And the template "Weekly shop" has the items "Milk, Eggs, Bread"

  Rule: A new task list can start from a template

    Scenario: Create a task list from a template and set its time
      Given I have the template "Packing" with the items "Passport, Charger, Toothbrush"
      When I open the week view for 2026-10-12
      And I start creating a task list
      And I choose the template "Packing"
      Then the template pill shows "Packing"
      And the task list form shows:
        | title | Packing                        |
        | items | Passport; Charger; Toothbrush  |
        | date  | 2026-10-12                     |
        | time  |                                |
      When I fill in the task list form with:
        | date | 2026-10-16 |
        | time | 07:00      |
      And I save the task list
      Then I see the task list "Packing" on 2026-10-16
      And the task list "Packing" is positioned at 07:00
      And the task list "Packing" shows the done count "0/3"

    Scenario: A template fills the estimate and the category
      Given I have the template "Clean bathroom" with the items "Sink, Floor", the estimate 45 minutes and the category "Home"
      When I open the day view for 2026-10-14
      And I start creating a task list
      And I choose the template "Clean bathroom"
      Then the task list form shows:
        | title    | Clean bathroom |
        | items    | Sink; Floor    |
        | estimate | 45             |
        | category | Home           |

    @day
    Scenario: Starting from a template keeps the time of the tapped slot
      Given I have the template "Errands" with the items "Post office, Bank"
      When I open the day view for 2026-10-14
      And I click the time slot 15:00 on 2026-10-14
      And I switch the new dialog to "Task list"
      And I choose the template "Errands"
      Then the task list form shows:
        | title | Errands           |
        | date  | 2026-10-14        |
        | time  | 15:00             |
        | items | Post office; Bank |

    Scenario: The list made from a template can be changed before it is saved and the template stays as it was
      Given I have the template "Packing" with the items "Passport, Charger"
      When I open the day view for 2026-10-14
      And I start creating a task list
      And I choose the template "Packing"
      And I fill in the task list form with:
        | title | Packing for Rome            |
        | items | Passport; Charger; Adapter  |
      And I save the task list
      Then the collapsed task list "Packing for Rome" lists the items "Passport, Charger, Adapter"
      And the template "Packing" has the items "Passport, Charger"

    Scenario: The same template can be used again and again
      Given I have the template "Clean bathroom" with the items "Sink, Floor"
      When I create a task list from the template "Clean bathroom" on 2026-10-13
      And I create a task list from the template "Clean bathroom" on 2026-10-20
      Then the calendar shows the task list "Clean bathroom" on 2026-10-13
      And the calendar shows the task list "Clean bathroom" on 2026-10-20

    Scenario: The template pill grows into a menu of the templates with their items, estimate and category
      Given I have the template "Weekly shop" with the items "Milk, Eggs, Bread", the estimate 45 minutes and the category "Shopping"
      And I have the template "Packing" with the items "Passport"
      When I open the day view for 2026-10-14
      And I start creating a task list
      Then the template pill shows "From template"
      When I open the template picker
      Then the template menu has grown out of the template pill
      And the template menu shows:
        | Packing     | 1 item                       |
        | Weekly shop | 3 items · ~45 min · Shopping |
      And the template menu ends with "Manage templates" below a divider

    Scenario: Without templates the picker says how to make one
      When I open the day view for 2026-10-14
      And I start creating a task list
      And I open the template picker
      Then the template picker says "No templates yet. Save a task list as a template to reuse it."

    Scenario: The template picker leads to the template management
      Given I have the template "Packing" with the items "Passport"
      When I open the day view for 2026-10-14
      And I start creating a task list
      And I open the template picker
      And I choose "Manage templates" in the template picker
      Then the settings page "Templates" is shown
      And the templates page lists "Packing"

  Rule: Templates are managed in the settings

    Scenario: The settings list every template
      Given I have the template "Weekly shop" with the items "Milk, Eggs, Bread"
      And I have the template "Packing" with the items "Passport"
      When I open the templates in the settings
      Then the templates page lists "Packing, Weekly shop"

    Scenario: Without templates the settings page says how to make one and offers a new one
      When I open the templates in the settings
      Then the templates page says "No templates yet. Save a task list as a template to reuse it."
      And the templates page offers "New template"

    Scenario: Create a template in the settings
      Given I have the template "Packing" with the items "Passport"
      When I open the templates in the settings
      Then the templates page offers "New template"
      When I start a new template
      Then the template sheet is titled "New template"
      And the template form shows:
        | name     |      |
        | items    |      |
        | estimate |      |
      When I fill in the template form with:
        | name     | Weekly shop       |
        | items    | Milk; Eggs; Bread |
        | estimate | 30                |
        | category | Shopping          |
      And I save the template
      Then the templates page lists "Packing, Weekly shop"
      And the template "Weekly shop" has the items "Milk, Eggs, Bread"

    @validation
    Scenario: A new template needs a name
      When I open the templates in the settings
      And I start a new template
      And I fill in the template form with:
        | items | Milk |
      And I save the template
      Then the template dialog shows the error "Give the template a name"
      And I have no templates

    Scenario: Rename a template
      Given I have the template "Packing" with the items "Passport"
      When I open the templates in the settings
      And I open the template "Packing"
      And I fill in the template form with:
        | name | City trip |
      And I save the template
      Then the templates page lists "City trip"

    Scenario: Change a template's items: add, remove, reorder and retitle
      Given I have the template "Weekly shop" with the items "Milk, Eggs, Bread"
      When I open the templates in the settings
      And I open the template "Weekly shop"
      And I fill in the template form with:
        | items | Bread; Oat milk; Apples |
      And I save the template
      Then the template "Weekly shop" has the items "Bread, Oat milk, Apples"

    Scenario: Change a template's estimate and category
      Given I have the template "Clean bathroom" with the items "Sink, Floor"
      When I open the templates in the settings
      And I open the template "Clean bathroom"
      And I fill in the template form with:
        | estimate | 30   |
        | category | Home |
      And I save the template
      And I open the template "Clean bathroom"
      Then the template form shows:
        | estimate | 30   |
        | category | Home |

    Scenario: Changing a template leaves lists already made from it alone
      Given I have the template "Weekly shop" with the items "Milk, Eggs"
      And I create a task list from the template "Weekly shop" on 2026-10-14
      When I open the templates in the settings
      And I open the template "Weekly shop"
      And I fill in the template form with:
        | items | Bread |
      And I save the template
      And I open the day view for 2026-10-14
      Then the collapsed task list "Weekly shop" lists the items "Milk, Eggs"

    @validation
    Scenario: A template needs a name
      Given I have the template "Packing" with the items "Passport"
      When I open the templates in the settings
      And I open the template "Packing"
      And I fill in the template form with:
        | name |  |
      And I save the template
      Then the template dialog shows the error "Give the template a name"

    @cancel
    Scenario: Cancelling the template dialog changes nothing
      Given I have the template "Packing" with the items "Passport"
      When I open the templates in the settings
      And I open the template "Packing"
      And I fill in the template form with:
        | name  | Changed  |
        | items | Charger  |
      And I cancel the template dialog
      Then the templates page lists "Packing"
      And the template "Packing" has the items "Passport"

    Scenario: Delete a template
      Given I have the template "Packing" with the items "Passport"
      And I have the template "Weekly shop" with the items "Milk"
      When I open the templates in the settings
      And I delete the template "Packing"
      Then the templates page lists "Weekly shop"
      When the undo time is over
      And I reload the page
      Then the templates page lists "Weekly shop"

    @undo
    Scenario: Undoing a template deletion brings it back
      Given I have the template "Packing" with the items "Passport"
      When I open the templates in the settings
      And I delete the template "Packing"
      And I undo the deletion
      And the undo time is over
      And I reload the page
      Then the templates page lists "Packing"
      And the template "Packing" has the items "Passport"

    Scenario: Deleting a template leaves lists already made from it alone
      Given I have the template "Packing" with the items "Passport"
      And I create a task list from the template "Packing" on 2026-10-14
      When I open the templates in the settings
      And I delete the template "Packing"
      And the undo time is over
      Then I have no templates
      And the calendar shows the task list "Packing" on 2026-10-14

  Rule: Templates follow the person

    Scenario: A template saved on one device is there on another
      Given the calendar contains a task list "Packing" on 2026-10-14 with items:
        | item     | done |
        | Passport | no   |
      When I open the day view for 2026-10-14
      And I expand the task list "Packing"
      And I save the task list as a template
      And I confirm the template
      And I switch to another device
      And I open the templates in the settings
      Then the templates page lists "Packing"

    Scenario: Templates never show in the calendar or in Google
      Given I have the template "Packing" with the items "Passport"
      When I open the week view for 2026-10-12
      Then I do not see the task list "Packing"
      And Google contains no event "Packing"

  Rule: Templates are kept on this device

    @offline @last-known-state
    Scenario: Without a connection the template picker lists the templates and fills the form
      Given I have the template "Weekly shop" with the items "Milk, Eggs", the estimate 45 minutes and the category "Shopping"
      And I have seen the day view for 2026-10-14
      And the network connection is lost
      When I open the app again
      And I start creating a task list
      And I open the template picker
      Then the template menu shows:
        | Weekly shop | 2 items · ~45 min · Shopping |
      When I choose the template "Weekly shop"
      Then the task list form shows:
        | title    | Weekly shop |
        | items    | Milk; Eggs  |
        | estimate | 45          |
        | category | Shopping    |

    @offline @last-known-state
    Scenario: Without a connection the settings list the templates
      Given I have the template "Weekly shop" with the items "Milk"
      And I have the template "Packing" with the items "Passport"
      And I have seen the day view for 2026-10-12
      And the network connection is lost
      When I open the app again
      And I open the templates in the settings
      Then the templates page lists "Packing, Weekly shop"

    @offline @last-known-state
    Scenario: Without a connection a template cannot be changed
      Given I have the template "Packing" with the items "Passport"
      And I have seen the day view for 2026-10-12
      And the network connection is lost
      When I open the app again
      And I open the templates in the settings
      And I open the template "Packing"
      And I fill in the template form with:
        | name | Packing for Rome |
      And I save the template
      Then I see the sync error banner
      And the templates page lists "Packing"
      And my templates are "Packing"
