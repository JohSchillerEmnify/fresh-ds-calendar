@birthdays @events
Feature: Birthdays from Google Contacts
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
