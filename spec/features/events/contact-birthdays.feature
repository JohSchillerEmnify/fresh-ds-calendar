@birthdays @events @id:contact-birthdays
Feature: Birthdays from Google Contacts
  The dates a person keeps in Google Contacts (birthdays, anniversaries and other dates) show in the app's "Birthdays"
  calendar (feature birthdays), in its colour and behind its switch, like the birthdays that come as calendar events.
  Google's Calendar API only passes on some of them, so the app also reads the person's contacts, once the person has
  allowed it ("see your contacts", read-only). Nobody is signed out for this: while the permission is missing, the app
  shows a message in the banner place at the top (the one for "sign in again" and "grant calendar access") that says
  birthdays from Google Contacts can be shown once access is allowed, with a link that asks Google for it. The message
  can be dismissed (kept per person), and stops showing once access is granted. The Birthdays calendar's settings offer
  the same link later. Without the permission the app works as before.
  A contact date is read-only in the app: it is changed in Google Contacts. One that Google also sends as a calendar
  birthday event shows once (the calendar event wins). Everything is per person and is kept on the device like all other
  data. An anniversary is titled and marked like a calendar anniversary (the person's name, with the ring); another date
  is titled "<label>: <name>" (no marker). Only a birthday shows an age, and only in its details ("Turns N", never on the
  chip, none without a year).
  The Birthdays calendar exists only in the app, so nothing here is written to Google.

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And the contacts permission is granted

  @backlog
  Scenario: A contact birthday shows under Birthdays in its colour
    Given the Google contacts have a birthday "Anna" on 1990-10-14
    When I open the month view for 2026-10
    Then I see the event "Anna" on 2026-10-14
    And the event "Anna" is marked as a birthday
    And the event "Anna" is in the calendar "Birthdays"
    And the event "Anna" has the color "#9fc6e7"

  @backlog
  Scenario: A contact birthday repeats every year
    Given the Google contacts have a birthday "Anna" on 1990-10-14
    When I open the month view for 2027-10
    Then I see the event "Anna" on 2027-10-14

  @backlog
  Scenario: Switching Birthdays off hides the contact birthdays too
    Given the Google contacts have a birthday "Anna" on 1990-10-14
    And the calendar contains an all-day event "Holiday" on 2026-10-14
    When I open the month view for 2026-10
    And I hide the calendar "Birthdays" in the filter bar
    Then I do not see the event "Anna" on 2026-10-14
    And I see the event "Holiday" on 2026-10-14

  @backlog
  Scenario: A contact birthday takes the colour chosen for Birthdays
    Given the Google contacts have a birthday "Anna" on 1990-10-14
    When I open the settings
    And I open the settings group "Calendars"
    And I open the calendar "Birthdays" in the settings
    And I choose the palette colour 8 on the calendar's settings page
    And I leave the settings
    Then the event "Anna" has the color "#16a765"

  @backlog
  Scenario: A birthday that is also a calendar birthday shows once, linked by the contact
    Given the Google contacts have a birthday "Anna" on 1990-10-14
    And the calendar "Personal" has a birthday "Anna M." on 2026-10-14 linked to the contact "Anna"
    When I open the month view for 2026-10
    Then the event "Anna M." is shown once on 2026-10-14
    And I do not see the event "Anna" on 2026-10-14

  @backlog
  Scenario: A birthday with the same name and date as a calendar birthday shows once
    Given the Google contacts have a birthday "Anna" on 1990-10-14
    And the calendar "Personal" has a birthday "Anna" on 2026-10-14
    When I open the month view for 2026-10
    Then the event "Anna" is shown once on 2026-10-14

  @backlog
  Scenario: Two contacts with the same name on different days both show
    Given the Google contacts have a birthday "Anna" on 1990-10-14
    And the Google contacts have a birthday "Anna" on 1985-10-20
    When I open the month view for 2026-10
    Then the event "Anna" is shown once on 2026-10-14
    And the event "Anna" is shown once on 2026-10-20

  @backlog
  Scenario: A contact birthday with a year shows the age in its details
    Given the Google contacts have a birthday "Anna" on 1990-10-14
    When I open the week view for 2026-10-12
    And I open the event "Anna"
    Then the event dialog shows the age 36

  @backlog
  Scenario: A contact birthday without a year shows no age
    Given the Google contacts have a birthday "Max" on "10-15" without a year
    When I open the week view for 2026-10-12
    Then I see the event "Max" on 2026-10-15
    When I open the event "Max"
    Then the event dialog shows no age

  @backlog
  Scenario: A contact birthday is read-only and points to Google Contacts
    Given the Google contacts have a birthday "Anna" on 1990-10-14
    When I open the week view for 2026-10-12
    And I open the event "Anna"
    Then the event dialog is read-only
    And the event dialog has no save or delete button
    And the event dialog shows the hint "Change this birthday in Google Contacts"

  @backlog
  Scenario: A contact anniversary shows like a calendar anniversary
    Given the Google contacts have an anniversary "Max and Eva" on 2010-10-14
    When I open the month view for 2026-10
    Then I see the event "Max and Eva" on 2026-10-14
    And the event "Max and Eva" is marked as an anniversary
    And the event "Max and Eva" is in the calendar "Birthdays"

  @backlog
  Scenario: A contact anniversary shows no age
    Given the Google contacts have an anniversary "Max and Eva" on 2010-10-14
    When I open the week view for 2026-10-12
    And I open the event "Max and Eva"
    Then the event dialog is read-only
    And the event dialog shows no age

  @backlog
  Scenario: A custom date of a contact shows with its label and the name
    Given the Google contacts have a custom date "Moving day" for "Anna" on 2015-10-15
    When I open the month view for 2026-10
    Then I see the event "Moving day: Anna" on 2026-10-15
    And the event "Moving day: Anna" is not marked as a birthday
    And the event "Moving day: Anna" is in the calendar "Birthdays"

  @backlog
  Scenario: A custom date is read-only and shows no age
    Given the Google contacts have a custom date "Moving day" for "Anna" on 2015-10-15
    When I open the week view for 2026-10-12
    And I open the event "Moving day: Anna"
    Then the event dialog is read-only
    And the event dialog shows the hint "Change this birthday in Google Contacts"
    And the event dialog shows no age

  @backlog
  Scenario: A contact birthday is shown on the device without a connection
    Given the Google contacts have a birthday "Anna" on 1990-10-14
    And I have seen the month view for 2026-10-12
    And the app has synced this device
    And the device is offline
    When I open the app again
    Then I see the event "Anna" on 2026-10-14
    And the event "Anna" is marked as a birthday

  @backlog
  Scenario: A birthday removed from Google Contacts disappears after the next sync
    Given the Google contacts have a birthday "Anna" on 1990-10-14
    And I have seen the month view for 2026-10-12
    When the Google contacts no longer have the birthday "Anna"
    And I wait for the automatic sync
    Then I do not see the event "Anna" on 2026-10-14

  @backlog
  Scenario: Contact birthdays of one person do not show for another
    Given the Google contacts of "anna@example.com" have a birthday "Lena" on 1992-10-16
    And "anna@example.com" and "jo@example.com" may use the calendar
    And "jo@example.com" is signed in
    When I open the month view for 2026-10
    Then I do not see the event "Lena" on 2026-10-16

  @backlog
  Scenario: Without the permission a message offers to allow Google Contacts and nothing breaks
    Given the contacts permission is not granted
    And the Google contacts have a birthday "Anna" on 1990-10-14
    And the Birthdays calendar has a birthday "Carl" on 2026-10-16
    When I open the month view for 2026-10
    Then I am told that birthdays from Google Contacts can be shown
    And the message has a link to allow it
    And I see the event "Carl" on 2026-10-16
    And I do not see the event "Anna" on 2026-10-14
    And I am still signed in

  @backlog
  Scenario: Following the link in the message brings the contact birthdays in
    Given the contacts permission is not granted
    And the Google contacts have a birthday "Anna" on 1990-10-14
    When I open the month view for 2026-10
    And I follow the link of the message about Google Contacts
    Then I see the event "Anna" on 2026-10-14
    And I am no longer told that birthdays from Google Contacts can be shown

  @backlog
  Scenario: The message can be dismissed and stays away
    Given the contacts permission is not granted
    When I open the month view for 2026-10
    And I dismiss the message about Google Contacts
    Then I am no longer told that birthdays from Google Contacts can be shown
    When I open the app again
    Then I am no longer told that birthdays from Google Contacts can be shown

  @backlog
  Scenario: After dismissing the message the Birthdays settings still offer the link
    Given the contacts permission is not granted
    And the Google contacts have a birthday "Anna" on 1990-10-14
    When I open the month view for 2026-10
    And I dismiss the message about Google Contacts
    And I open the settings
    And I open the settings group "Calendars"
    And I open the calendar "Birthdays" in the settings
    Then the Birthdays settings offer to allow Google Contacts
    When I allow Google Contacts
    And I leave the settings
    And I open the month view for 2026-10
    Then I see the event "Anna" on 2026-10-14

  @backlog
  Scenario: With the permission there is no message and no offer
    When I open the month view for 2026-10
    Then I am no longer told that birthdays from Google Contacts can be shown
    When I open the settings
    And I open the settings group "Calendars"
    And I open the calendar "Birthdays" in the settings
    Then the Birthdays settings do not offer to allow Google Contacts

  @backlog
  Scenario: When Google Contacts cannot be read the other birthdays stay
    Given the Google contacts answer with an error
    And the Birthdays calendar has a birthday "Carl" on 2026-10-16
    When I open the month view for 2026-10
    Then I see the event "Carl" on 2026-10-16
