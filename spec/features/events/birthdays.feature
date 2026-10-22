@birthdays @events @id:birthdays
Feature: Birthdays
  Google's "Birthdays" calendar (made from the person's contacts) is shown like any other calendar, but its entries are
  recognisable as birthdays: an all-day chip with a cake marker (a ring for an anniversary), in the colour of the
  Birthdays calendar. Birthdays are read-only: opening one shows the details, with no way to edit or delete it.

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And the Birthdays calendar has a birthday "Anna" on 2026-10-14
    And the Birthdays calendar has an anniversary "Max and Eva" on 2026-10-14

  Scenario Outline: A birthday shows as a birthday in every view
    When I open the <view> view for <period>
    Then I see the event "Anna" on 2026-10-14
    And the event "Anna" is marked as a birthday
    And the event "Max and Eva" is marked as an anniversary

    Examples:
      | view  | period     |
      | month | 2026-10    |
      | week  | 2026-10-12 |
      | day   | 2026-10-14 |

  Scenario: A birthday has the colour of the Birthdays calendar
    When I open the month view for 2026-10
    Then the event "Anna" has the color "#9fc6e7"

  Scenario: A birthday cannot be edited
    When I open the week view for 2026-10-12
    And I open the event "Anna"
    Then the event dialog is open
    And the event dialog is read-only
    And the event dialog has no save or delete button

  Scenario: Other events do not get the marker
    Given the calendar contains an all-day event "Holiday" on 2026-10-14
    When I open the month view for 2026-10
    Then the event "Holiday" is not marked as a birthday

  @google-birthdays
  Scenario: A birthday created in Google Calendar shows as a birthday
    Given the calendar "Personal" has a birthday "Lena" on 2026-10-15
    When I open the month view for 2026-10
    Then the event "Lena" is marked as a birthday

  @google-birthdays
  Scenario: I create a birthday like in Google Calendar
    When I open the month view for 2026-10
    And I choose "Birthday" in the create menu
    And I enter the birthday name "Lena"
    And I set the birthday date to 2026-10-15
    And I save the birthday
    Then the event "Lena" is marked as a birthday
    And Google has a birthday "Lena" repeating every year from 2026-10-15
    And the event "Lena" is shown on 2027-10-15

  @google-birthdays
  Scenario: A birthday on 29 February repeats on the last day of February
    When I open the month view for 2026-10
    And I choose "Birthday" in the create menu
    And I enter the birthday name "Leap"
    And I set the birthday date to 2028-02-29
    And I save the birthday
    Then Google has the birthday "Leap" with the rule "RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1"

  @google-birthdays
  Scenario: I rename and move a birthday for every year
    Given the calendar "Personal" has a birthday "Lena" on 2026-10-15
    When I open the month view for 2026-10
    And I open the event "Lena"
    And I change the birthday name to "Lena M."
    And I set the birthday date to 2026-10-16
    And I save the birthday
    Then Google has a birthday "Lena M." repeating every year from 2026-10-16

  @google-birthdays
  Scenario: A birthday from Google Contacts keeps its date
    Given the calendar "Personal" has a birthday "Anne" on 2026-10-15 linked to a contact
    When I open the month view for 2026-10
    And I open the event "Anne"
    Then the birthday date cannot be changed
    And the birthday name can be changed

  @google-birthdays
  Scenario: Deleting a birthday removes it from every year
    Given the calendar "Personal" has a birthday "Lena" on 2026-10-15
    When I open the month view for 2026-10
    And I open the event "Lena"
    And I delete the event
    Then I do not see the event "Lena" on 2026-10-15
    And Google has no birthday "Lena"
