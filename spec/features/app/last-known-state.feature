@offline @last-known-state @id:last-known-state
Feature: Everything I see is kept on this device and synced with the server
  The app keeps all of my data on this device and always shows it from there; the screen never waits for the server
  (owner, 2026-10-23: "the app sometimes takes quite long to load things if internet is bad"; 2026-10-25, ADR 0025:
  "Everything is always stored on the device … only then afterwards will we have things on the server").
  Kept are the events and birthdays from a year back to a year ahead of today, every task list with its items (dated
  or not, old or new, finished or open, shared with me or not), the settings with the categories, the preferences
  (bedtime, notifications, language and the rest), the calendars, the chosen theme and my own themes, the task list
  templates (feature tasklist-templates), the Canvas areas, the reminder defaults, the people I can share with, my
  streak and plant, and which optional plugins are on. Days further away load from the server when I
  open them and are not kept.
  The device takes in what changed on the server (made on another device, or in Google Calendar itself) when the app
  opens, when it regains focus or the connection, and at the polling interval, also for days I never opened.
  While what I see has not been confirmed by the server since the app opened, or the last sync failed, a small note
  says when it was last updated.
  This slice changes only reading: without a connection nothing can be changed yet, saving still fails with the sync
  banner (writing to the device first and sending later comes with the next slice).
  Everything is kept separately for each signed-in person: signing out, or someone else signing in, removes it.

  Background:
    Given the calendar is empty
    And the time is 2026-10-12 08:12

  Scenario: Without a connection the app shows the last known calendar
    Given the calendar contains an event "Dentist" on 2026-10-13 from 10:00 to 11:00
    And I have seen the week view for 2026-10-12
    And the network connection is lost
    When I open the app again
    Then the event "Dentist" is positioned on 2026-10-13 from 10:00 to 11:00
    And I see the sync error banner
    And I am told the calendar was last updated at "08:12"

  Scenario: On a slow connection the last known state shows at once and is then updated
    Given the calendar contains an event "Dentist" on 2026-10-13 from 10:00 to 11:00
    And I have seen the week view for 2026-10-12
    And Google moves the event "Dentist" to 2026-10-13 from 11:00 to 12:00
    And the server answers only after 10 seconds
    When I open the app again
    Then the event "Dentist" is positioned on 2026-10-13 from 10:00 to 11:00
    And I am told the calendar was last updated at "08:12"
    When the server has answered
    Then the event "Dentist" is positioned on 2026-10-13 from 11:00 to 12:00
    And I am not told when the calendar was last updated

  Scenario: Task lists and my settings are kept too
    Given the calendar contains a task list "Groceries" on 2026-10-12 with items:
      | item | done |
      | Milk | yes  |
      | Eggs | no   |
    And I open the day view for 2026-10-12
    And I open the settings
    And I choose "Deutsch" as the language
    And I choose the theme mode "Dark"
    And I have seen the day view for 2026-10-12
    And the network connection is lost
    When I open the app again
    And I expand the task list "Groceries"
    Then the item "Milk" is ticked
    And the app uses the dark theme
    And the page language is "de"

  Scenario: Without a connection the coming weeks show even when I never opened them
    Given the calendar contains an event "Dentist" on 2026-10-13 from 10:00 to 11:00
    And the calendar contains an event "Haircut" on 2026-10-21 from 15:00 to 16:00
    And I have seen the week view for 2026-10-12
    And the network connection is lost
    When I open the app again
    And I go to the next period
    Then I see the event "Haircut" on 2026-10-21
    And I see the sync error banner

  Scenario: Without a connection birthdays and events months ahead show
    Given the Birthdays calendar has a birthday "Anna" on 2027-02-03
    And the calendar contains an all-day event "Conference" on 2027-09-14
    And I open the app
    And the app has synced this device
    And the network connection is lost
    When I open the app again
    And I open the month view for 2027-02
    Then I see the event "Anna" on 2027-02-03
    And the event "Anna" is marked as a birthday
    When I open the month view for 2027-09
    Then I see the all-day event "Conference" on 2027-09-14

  Scenario: Without a connection every task list shows, dated or not, also an old one still open
    Given the calendar contains an undated task list "Taxes" with items:
      | item | done |
      | Form | no   |
    And the calendar contains a task list "Visa" on 2025-06-02 with items:
      | item     | done |
      | Passport | no   |
    And the calendar contains a task list "Groceries" on 2026-10-12 with items:
      | item | done |
      | Milk | no   |
    And I open the Canvas
    And I create the area "Haus" on the Canvas
    And the app has synced this device
    And the network connection is lost
    When I open the app again
    Then the Canvas shows the area "Haus"
    When I open the Tasks view
    Then the Tasks view lists "Visa" under "Overdue"
    And the Tasks view lists "Groceries" under "Today"
    And the Tasks view lists "Taxes" under "No date"

  Scenario: Without a connection my categories and bedtime still apply
    Given bedtime mode is on with fixed times 22:30 and 06:30
    And I open the app
    And I open the settings
    And I add the category "Errands" with the color "#0b8043"
    And I have seen the day view for 2026-10-12
    And the network connection is lost
    When I open the app again
    Then the night bands of 2026-10-12 are "00:00-06:30, 22:30-24:00"
    And the category "Errands" has the color "#0b8043"

  @signin @themes
  Scenario: Without a connection my own theme still applies
    Given "jo@example.com" may use the calendar
    And "jo@example.com" imported the theme file "ocean.json"
    And "jo@example.com" uses the imported theme "Ocean"
    And the seasons and holidays are off
    And "jo@example.com" is signed in
    And I have seen the week view for 2026-10-12
    And the network connection is lost
    When I open the app again
    Then the theme "Ocean" is in use
    And the top bar draws the decor "waves"

  Scenario: Events more than a year away are not kept, opening their day loads them
    Given the calendar contains an event "Wedding" on 2027-11-20 from 14:00 to 18:00
    And I open the app
    And the app has synced this device
    And the network connection is lost
    When I open the app again
    And I open the month view for 2027-11
    Then I do not see the event "Wedding"
    And I see the sync error banner
    When the network connection is restored
    And I open the month view for 2027-11
    Then I see the event "Wedding" on 2027-11-20
    When the network connection is lost
    And I open the app again
    Then I do not see the event "Wedding"

  Scenario: A change made elsewhere is taken in at the next sync, also on days I never opened
    Given the calendar contains an event "Dentist" on 2026-10-13 from 10:00 to 11:00
    And automatic sync runs every 2 seconds
    And I open the week view for 2026-10-12
    And the app has synced this device
    When Google adds an event "Flight" on 2027-03-01 from 07:00 to 09:00
    And Google deletes the event "Dentist"
    And I wait for the automatic sync
    Then I do not see the event "Dentist"
    When the network connection is lost
    And I open the app again
    And I open the month view for 2027-03
    Then I see the event "Flight" on 2027-03-01

  Scenario: Settings and preferences changed on another device arrive when the app regains focus
    Given I open the week view for 2026-10-12
    And the app has synced this device
    When the settings are changed elsewhere to the theme mode "Dark"
    And the language is changed elsewhere to "de"
    And the app regains focus
    Then the app uses the dark theme
    And the page language is "de"

  Scenario: The note says when the calendar was last updated while a sync fails
    Given the calendar contains an event "Dentist" on 2026-10-13 from 10:00 to 11:00
    And I have seen the week view for 2026-10-12
    And I am not told when the calendar was last updated
    When the network connection is lost
    And the app regains focus
    Then I see the sync error banner
    And I am told the calendar was last updated at "08:12"
    When the network connection is restored
    Then I do not see the sync error banner
    And I am not told when the calendar was last updated

  Scenario: Without a connection a change is not saved yet
    Given the calendar contains a task list "Groceries" on 2026-10-12 with items:
      | item | done |
      | Milk | no   |
    And I have seen the day view for 2026-10-12
    And the network connection is lost
    When I open the app again
    And I expand the task list "Groceries"
    And I tick the item "Milk"
    Then I see the sync error banner
    And the item "Milk" is not ticked

  @signin
  Scenario: Signing out removes the stored calendar from the device
    Given "jo@example.com" and "anna@example.com" may use the calendar
    And "jo@example.com" has an event "Dentist" on 2026-10-13 from 10:00 to 11:00
    And "jo@example.com" is signed in
    And I have seen the week view for 2026-10-12
    And this device keeps a last known calendar
    When they sign out in the settings
    Then they see the sign-in page
    And this device keeps no last known calendar

  @signin
  Scenario: Someone else signing in on this device sees nothing of mine
    Given "jo@example.com" and "anna@example.com" may use the calendar
    And "jo@example.com" has an event "Dentist" on 2026-10-13 from 10:00 to 11:00
    And "jo@example.com" is signed in
    And I have seen the week view for 2026-10-12
    When they sign out in the settings
    And "anna@example.com" signs in with Google
    And I have seen the week view for 2026-10-12
    And the network connection is lost
    And I open the app again
    Then I do not see the event "Dentist"
    And I see the sync error banner

  @signin @templates
  Scenario: Someone else signing in on this device does not get my templates
    Given "jo@example.com" and "anna@example.com" may use the calendar
    And "jo@example.com" is signed in
    And "jo@example.com" has the template "Packing" with the items "Passport"
    And I have seen the week view for 2026-10-12
    When they sign out in the settings
    And "anna@example.com" signs in with Google
    And I have seen the week view for 2026-10-12
    And the network connection is lost
    And I open the app again
    And I open the templates in the settings
    Then the templates page says "No templates yet. Save a task list as a template to reuse it."
