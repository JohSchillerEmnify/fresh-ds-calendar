@birthdays @events @id:birthdays
Feature: Birthdays
  Birthdays are recognisable in every view: an all-day chip with a cake marker (a ring for an anniversary). They come
  from Google's old "Birthdays" calendar (made from the person's contacts; read-only, and it may be hidden in Google's
  list) and from Google Calendar birthday events in a normal calendar (since 2025 Google's API has no other Birthdays
  calendar). Those I can create, rename, move and delete like in Google Calendar: they repeat every year (29 February
  on the last day of February), and one linked to a Google contact keeps its date but can be renamed. Other events
  never get the marker.
  All of them are one calendar of the app, "Birthdays" (owner decision, issue 59): it has its own entry in the filter
  bar, the side menu and Settings > Calendars, with its own switch and colour. Both are kept per person in the app
  (Google offers no colour for it) and no longer follow "Personal". A birthday with a colour of its own keeps it, as in
  Google. A birthday that is in both places (the same contact) shows once. There is one switch only: the app has no
  "Sync from Contacts" choice. Creating a birthday works as before; it lands under "Birthdays".

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

  Scenario: Birthdays are one calendar of their own
    When I open the month view for 2026-10
    Then the filter bar offers the calendar "Birthdays" once
    And the event "Anna" is in the calendar "Birthdays"

  Scenario: Switching Birthdays off hides every birthday but not the other events
    Given the calendar "Personal" has a birthday "Lena" on 2026-10-15
    And the calendar contains an all-day event "Holiday" on 2026-10-15
    When I open the month view for 2026-10
    And I hide the calendar "Birthdays" in the filter bar
    Then I do not see the event "Anna" on 2026-10-14
    And I do not see the event "Lena" on 2026-10-15
    And I see the event "Holiday" on 2026-10-15

  Scenario: Switching Personal off leaves the birthdays
    Given the calendar "Personal" has a birthday "Lena" on 2026-10-15
    And the calendar contains an all-day event "Holiday" on 2026-10-15
    When I open the month view for 2026-10
    And I hide the calendar "Personal" in the filter bar
    Then I do not see the event "Holiday" on 2026-10-15
    And I see the event "Lena" on 2026-10-15
    And I see the event "Anna" on 2026-10-14

  Scenario: Birthdays have their own colour, set in the settings
    Given the calendar "Personal" has a birthday "Lena" on 2026-10-15
    When I open the settings
    And I open the settings group "Calendars"
    And I open the calendar "Birthdays" in the settings
    And I choose the palette colour 8 on the calendar's settings page
    And I leave the settings
    Then the event "Anna" has the color "#16a765"
    And the event "Lena" has the color "#16a765"

  Scenario: The Birthdays settings page has no default reminders
    When I open the settings
    And I open the settings group "Calendars"
    And I open the calendar "Birthdays" in the settings
    Then the settings page shows the setting "Color"
    And the settings page does not show the setting "Default reminders"

  Scenario: A birthday from the old contacts calendar shows even when Google hides that calendar
    Given Google hides the old Birthdays calendar
    And the Birthdays calendar has a birthday "Carl" on 2026-10-16
    When I open the month view for 2026-10
    Then the event "Carl" is marked as a birthday
    And the event "Carl" is in the calendar "Birthdays"
    And the filter bar offers the calendar "Birthdays" once

  @google-birthdays
  Scenario: A birthday that is in both places shows once
    Given the calendar "Personal" has a birthday "Anna" on 2026-10-14 linked to a contact
    When I open the month view for 2026-10
    Then the event "Anna" is shown once on 2026-10-14

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
    And the event "Lena" is in the calendar "Birthdays"
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
