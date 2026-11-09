@events-readonly @id:events-readonly
Feature: Only my own events can be edited
  Events I organise in my own calendars are editable. So is everything in a shared group calendar I may write, such as
  the family calendar, whoever created the event (owner, 2026-11-09). Invitations from other people and everything in
  calendars that belong to other people (their own address) are look-only, even when Google would allow editing (owner,
  2026-10-16).

  Background:
    Given the calendar is empty
    And today is 2026-10-14

  Scenario: An invitation from someone else is read-only
    Given the calendar contains an event "Team lunch" on 2026-10-14 from 12:00 to 13:00 organised by "anna@example.org"
    When I open the week view for 2026-10-12
    And I open the event "Team lunch"
    Then the event dialog is read-only
    And the event dialog has no save or delete button
    And the read-only reason says "Invitation from anna@example.org"

  Scenario: An invitation whose organiser lets guests edit is editable
    Given the calendar contains an event "Potluck" on 2026-10-14 from 18:00 to 20:00 organised by "anna@example.org" with guests allowed to edit
    When I open the week view for 2026-10-12
    And I open the event "Potluck"
    Then the event dialog is editable

  Scenario: An event in someone else's shared calendar is read-only even with edit rights
    Given a calendar "Anna" shared with me with edit rights by "anna@example.org"
    And the calendar "Anna" contains an event "Yoga" on 2026-10-14 from 07:00 to 08:00
    When I open the week view for 2026-10-12
    And I open the event "Yoga"
    Then the event dialog is read-only
    And the read-only reason says "Calendar of anna@example.org"

  Scenario: An event someone else made in a shared family calendar I may edit is editable
    Given a family calendar "Family" shared with me with edit rights by "anna@example.org"
    And the calendar "Family" contains an event "Barbecue" on 2026-10-14 from 18:00 to 20:00
    When I open the week view for 2026-10-12
    And I open the event "Barbecue"
    Then the event dialog is editable

  Scenario: The family calendar is offered for new events
    Given a family calendar "Family" shared with me with edit rights by "anna@example.org"
    When I start a new event
    Then the calendar picker offers "Family"

  Scenario: The server accepts a change to an event in the family calendar
    Given a family calendar "Family" shared with me with edit rights by "anna@example.org"
    And the calendar "Family" contains an event "Barbecue" on 2026-10-14 from 18:00 to 20:00
    When I try to rename the event "Barbecue" through the API
    Then the API answers 200

  Scenario: Someone else's calendar is not offered for new events
    Given a calendar "Anna" shared with me with edit rights by "anna@example.org"
    When I start a new event
    Then the calendar picker does not offer "Anna"

  Scenario: The server refuses to change an event that is not mine
    Given the calendar contains an event "Team lunch" on 2026-10-14 from 12:00 to 13:00 organised by "anna@example.org"
    When I try to rename the event "Team lunch" through the API
    Then the API answers 403

  Scenario: My own events stay editable
    Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    When I open the week view for 2026-10-12
    And I open the event "Dentist"
    Then the event dialog is editable
