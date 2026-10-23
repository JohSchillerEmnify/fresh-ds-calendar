@categories @tasklists @id:task-list-categories
Feature: Task list categories, tags and filters
  Categories are user-defined (name, color, optional emoji icon) and managed in Settings.
  First run ships Shopping 🛒 (#0b8043), To-do ✅ (#3f51b5), Work 💼 (#8e24aa) and Home 🏠 (#f4511e)
  with the fixed ids shopping, todo, work and home.
  A task list has at most one category (its color source). Free tags are shelved (owner, 2026-10-13: their purpose
  and flow are unclear): no tag input, display or filter; tag scenarios are @backlog.
  A task list without a category uses the color of its calendar.
  Filter chips limit the task lists shown; events are never hidden by these filters.

  Background:
    Given the calendar is empty
    And today is 2026-10-12

  # --- Managing categories -------------------------------------------------

  Scenario: Add a category
    When I open the path "/settings"
    And I add the category "Garden" with the color "#0a7f42" and the icon "🌱"
    Then the categories are "Shopping, To-do, Work, Home, Garden"
    And the category "Garden" has the color "#0a7f42"
    When I reload the page
    Then the categories are "Shopping, To-do, Work, Home, Garden"

  Scenario: Add a category without an icon
    When I open the path "/settings"
    And I add the category "Errands" with the color "#ff9800"
    Then the categories are "Shopping, To-do, Work, Home, Errands"

  @validation
  Scenario Outline: Invalid categories are rejected
    When I open the path "/settings"
    And I add the category "<name>" with the color "<color>"
    Then the category dialog shows the error "<error>"
    And the categories are "Shopping, To-do, Work, Home"

    Examples:
      | name     | color   | error                                   |
      |          | #0a7f42 | Name is required                        |
      | shopping | #0a7f42 | A category with this name already exists |
      | Garden   | green   | Enter a color like #1a73e8              |

  Scenario: Rename a category
    When I open the path "/settings"
    And I rename the category "Home" to "Household"
    Then the categories are "Shopping, To-do, Work, Household"

  Scenario: Recoloring a category recolors its task lists
    Given the calendar contains a task list "Groceries" in the category "Shopping" on 2026-10-14
    When I open the path "/settings"
    And I change the color of the category "Shopping" to "#e67c73"
    And I open the week view for 2026-10-12
    Then the task list "Groceries" has the color "#e67c73"

  Scenario: Deleting a category leaves its task lists without a category
    Given the calendar contains a task list "Groceries" in the category "Shopping" on 2026-10-14
    When I open the path "/settings"
    And I delete the category "Shopping"
    And I confirm the deletion
    Then the categories are "To-do, Work, Home"
    When I open the week view for 2026-10-12
    Then the task list "Groceries" has the color "#039be5"
    And the task list "Groceries" shows no icon

  @cancel
  Scenario: Cancelling the category deletion keeps the category
    When I open the path "/settings"
    And I delete the category "Work"
    And I cancel the deletion
    Then the categories are "Shopping, To-do, Work, Home"

  # --- Category and tags on task lists ------------------------------------

  Scenario: Create a task list with a category
    When I open the week view for 2026-10-12
    And I start creating a task list
    And I fill in the task list form with:
      | title    | Groceries        |
      | date     | 2026-10-14       |
      | category | Shopping         |
      | items    | Milk; Eggs       |
    And I save the task list
    Then the task list "Groceries" has the color "#0b8043"
    And the task list "Groceries" shows the icon "🛒"
    And the Google event for the task list "Groceries" has the private extended property "categoryId" set to "shopping"
    And the Google event for the task list "Groceries" has the color ID "10"

  Scenario: A task list without a category uses the calendar color
    Given the calendar contains a task list "Ideas" on 2026-10-14 with items:
      | item  | done |
      | Paint | no   |
    When I open the week view for 2026-10-12
    Then the task list "Ideas" has the color "#039be5"
    And the task list "Ideas" shows no icon
    And the Google event for the task list "Ideas" has no color ID

  Scenario: Change the category of a task list
    Given the calendar contains a task list "Groceries" in the category "Shopping" on 2026-10-14
    When I open the week view for 2026-10-12
    And I expand the task list "Groceries"
    And I edit the task list details
    Then the task list form shows:
      | category | Shopping |
    When I fill in the task list form with:
      | category | Home |
    And I save the task list
    Then the task list "Groceries" has the color "#f4511e"
    And the task list "Groceries" shows the icon "🏠"
    And the Google event for the task list "Groceries" has the color ID "6"

  Scenario: Remove the category from a task list
    Given the calendar contains a task list "Groceries" in the category "Shopping" on 2026-10-14
    When I open the week view for 2026-10-12
    And I expand the task list "Groceries"
    And I edit the task list details
    And I fill in the task list form with:
      | category | No category |
    And I save the task list
    Then the task list "Groceries" has the color "#039be5"

  @google
  Scenario Outline: Category colors map to the nearest Google event color
    When I open the path "/settings"
    And I add the category "Test" with the color "<color>"
    And I open the week view for 2026-10-12
    And I start creating a task list
    And I fill in the task list form with:
      | title    | Colored    |
      | date     | 2026-10-14 |
      | category | Test       |
    And I save the task list
    Then the task list "Colored" has the color "<color>"
    And the Google event for the task list "Colored" has the color ID "<colorId>"

    Examples:
      | color   | colorId |
      | #0a7f42 | 10      |
      | #e67c73 | 4       |
      | #ff9800 | 5       |
      | #2196f3 | 7       |
      | #9e9e9e | 8       |

  # --- Filtering ------------------------------------------------------------

  Scenario: Filter the calendar by one category
    Given the calendar contains a task list "Groceries" in the category "Shopping" on 2026-10-14
    And the calendar contains a task list "Report" in the category "Work" on 2026-10-14
    And the calendar contains a task list "Ideas" on 2026-10-15 with items:
      | item  | done |
      | Paint | no   |
    And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    When I open the week view for 2026-10-12
    And I filter by the category "Shopping"
    Then I see the task list "Groceries" on 2026-10-14
    And I do not see the task list "Report"
    And I do not see the task list "Ideas"
    And I see the event "Dentist" on 2026-10-14
    And the URL query is "categories=shopping"

  Scenario: Several selected categories are combined with "or"
    Given the calendar contains a task list "Groceries" in the category "Shopping" on 2026-10-14
    And the calendar contains a task list "Report" in the category "Work" on 2026-10-14
    And the calendar contains a task list "Laundry" in the category "Home" on 2026-10-15
    When I open the week view for 2026-10-12
    And I filter by the category "Shopping"
    And I filter by the category "Work"
    Then I see the task list "Groceries" on 2026-10-14
    And I see the task list "Report" on 2026-10-14
    And I do not see the task list "Laundry"

  Scenario: Filter by task lists without a category
    Given the calendar contains a task list "Groceries" in the category "Shopping" on 2026-10-14
    And the calendar contains a task list "Ideas" on 2026-10-15 with items:
      | item  | done |
      | Paint | no   |
    When I open the week view for 2026-10-12
    And I filter by the category "No category"
    Then I see the task list "Ideas" on 2026-10-15
    And I do not see the task list "Groceries"

  @backlog
  Scenario: Filter by tag, and combine a tag with a category
    Given the calendar contains a task list "Groceries" in the category "Shopping" with the tags "weekend" on 2026-10-14
    And the calendar contains a task list "Hardware" in the category "Shopping" with the tags "diy" on 2026-10-15
    And the calendar contains a task list "Garage" in the category "Home" with the tags "weekend" on 2026-10-16
    When I open the week view for 2026-10-12
    And I filter by the tag "weekend"
    Then I see the task list "Groceries" on 2026-10-14
    And I see the task list "Garage" on 2026-10-16
    And I do not see the task list "Hardware"
    When I filter by the category "Shopping"
    Then I see the task list "Groceries" on 2026-10-14
    And I do not see the task list "Garage"
    And I do not see the task list "Hardware"

  Scenario: Clearing the filters shows all task lists again
    Given the calendar contains a task list "Groceries" in the category "Shopping" on 2026-10-14
    And the calendar contains a task list "Report" in the category "Work" on 2026-10-14
    When I open the week view for 2026-10-12
    And I filter by the category "Shopping"
    And I clear the filters
    Then I see the task list "Report" on 2026-10-14
    And the URL query is ""

  Scenario: Filters are deep-linkable and survive navigation
    Given the calendar contains a task list "Groceries" in the category "Shopping" on 2026-10-14
    And the calendar contains a task list "Report" in the category "Work" on 2026-10-21
    And the calendar contains a task list "Laundry" in the category "Home" on 2026-10-21
    When I open the path "/week/2026-10-12?categories=work"
    Then I do not see the task list "Groceries"
    And the category filter "Work" is selected
    When I go to the next period
    Then I see the task list "Report" on 2026-10-21
    And I do not see the task list "Laundry"
    And the URL query is "categories=work"

  @backlog
  Scenario: The tag filter offers only tags that are in use
    Given the calendar contains a task list "Groceries" in the category "Shopping" with the tags "weekend, urgent" on 2026-10-14
    And the calendar contains a task list "Garage" in the category "Home" with the tags "weekend" on 2026-10-16
    When I open the week view for 2026-10-12
    And I show the filters
    Then the tag filters are "urgent, weekend"

  @mobile @backlog
  Scenario: The filter chip row scrolls on its own on a phone
    Given I am using a phone
    And the calendar contains a task list "Groceries" in the category "Shopping" with the tags "weekend, urgent, birthday, holiday, garden" on 2026-10-14
    When I open the week view for 2026-10-12
    And I show the filters
    Then the page has no horizontal scroll

  # --- Switching task categories off (owner, 2026-10-14: users find them confusing) -----------------------------
  # Setting "Task list categories" (per person, default on). Off hides every category UI of task lists: the picker in the
  # task list dialog, the filter chips (Tasks view and calendar), "Category" grouping and sorting, the icon and the
  # category colour (a list then shows the colour of its calendar), and the category list in Settings. A stored filter,
  # grouping or sorting by category is ignored (default grouping and sorting apply). Stored categories on lists are kept,
  # so switching it on again brings everything back. Events have no categories and are not touched.

  Scenario: Switching task categories off hides them everywhere
    Given the calendar contains a task list "Milk" in the category "Shopping" on 2026-10-14
    And the calendar contains a task list "Plain" on 2026-10-14 with items:
      | item | done |
      | One  | no   |
    When I open the path "/settings"
    And I turn the task categories "off"
    Then the settings page shows no categories
    And the Tasks view offers no category filter, grouping or sorting
    When I open the new task list dialog in the Tasks view
    Then the task list dialog has no category field
    When I cancel the task list dialog
    And I open the path "/day/2026-10-14"
    Then the task list "Milk" shows no icon
    And the task lists "Milk" and "Plain" have the same color

  Scenario: An active category filter and a category grouping are ignored while off
    Given the calendar contains a task list "Milk" in the category "Shopping" on 2026-10-14
    And the calendar contains a task list "Report" in the category "Work" on 2026-10-13
    When I filter the Tasks view by the category "Shopping"
    And I group the Tasks view by "Category"
    And I open the path "/settings"
    And I turn the task categories "off"
    Then the Open tab lists "Milk"
    And the Open tab lists "Report"
    And the Tasks view is grouped by "Time"

  Scenario: Switching back on restores the category of a list
    Given the calendar contains a task list "Milk" in the category "Shopping" on 2026-10-14
    When I open the path "/settings"
    And I turn the task categories "off"
    And I retitle the task list "Milk" to "Oat milk" in the Tasks view
    And I open the path "/settings"
    And I turn the task categories "on"
    And I open the path "/day/2026-10-14"
    Then the task list "Oat milk" has the color "#0b8043"
    And the task list "Oat milk" shows the icon "🛒"

  # owner, 2026-10-23: the Labs views follow the switch like the rest of the app
  Scenario Outline: The Labs views draw no category colour while task categories are off
    Given the calendar contains a task list "Milk" in the category "Shopping" on 2026-10-14
    And task categories are off
    When I open the Labs view "<view>" for 2026-10-14
    Then the Labs view draws "Milk" in the colour of its calendar, never of its category

    Examples:
      | view       |
      | clock      |
      | timeline   |
      | strip      |
      | zoom month |
      | horizontal |
