@signin @id:google-sign-in
Feature: Signing in with Google
  The calendar is reachable from the internet, so only the people the owner allows can use it. Each person signs in
  with their own Google account; signing in also connects their Google calendar, so they see their own events.
  Everyone else sees only the sign-in page and gets no calendar data. A sign-in lasts 90 days and is extended every
  time the app is used. When Google stops accepting a person's access, the app asks them to sign in again.

  Background:
    Given today is 2026-10-12
    And "jo@example.com" and "anna@example.com" may use the calendar

  Scenario: An allowed person signs in with Google and sees their calendar
    Given "jo@example.com" has an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    When "jo@example.com" signs in with Google
    Then they see the week view for 2026-10-12
    And they see the event "Dentist" on 2026-10-14

  Scenario: A Google account that is not allowed is turned away
    Given "jo@example.com" has an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    When "stranger@example.com" signs in with Google
    Then they are told the calendar is private
    And they see no events

  Scenario: Without signing in nobody sees the calendar
    Given "jo@example.com" has an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    When someone opens the week view for 2026-10-12 without signing in
    Then they see the sign-in page
    And they see no events
    And the calendar data cannot be read without signing in

  Scenario: Signing out
    Given "jo@example.com" is signed in
    When they sign out in the settings
    Then they see the sign-in page
    And opening the week view for 2026-10-12 shows the sign-in page

  Scenario: Each person sees their own Google calendar
    Given "jo@example.com" has an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    And "anna@example.com" has an event "Yoga" on 2026-10-14 from 18:00 to 19:00
    When "anna@example.com" signs in with Google
    Then they see the event "Yoga" on 2026-10-14
    And they do not see the event "Dentist"

  Scenario: Lost Google access asks to sign in again
    Given "jo@example.com" is signed in
    And Google no longer accepts the access of "jo@example.com"
    When they open the week view for 2026-10-12
    Then they are asked to sign in with Google again
