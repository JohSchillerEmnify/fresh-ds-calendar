@calendars @holidays @id:holiday-regions
Feature: Holiday calendars of a region
  Issue #60: choose regional holiday calendars in the app, like Google's "calendars of interest". They are real public Google
  calendars (`<language>.<region>#holiday@group.v.calendar.google.com`; the `.official` variant holds the public holidays
  only, the plain one also the observances). The app offers a curated list of countries; the server checks every id against
  Google before it offers it, and leaves out one Google does not know. Google has no list of regions and no state-level
  holiday calendars, so the choice is per country. The calendar's language follows the app language (German or English).
  Settings › Calendars has a "Holidays" section: the subscribed holiday calendars (each with its switch and colour like any
  calendar) and an "Add region" row that opens a picker, searchable by country name in the app language. A region with both
  variants asks "Public holidays only" or "Holidays and observances". Adding and removing needs a connection (the sheet
  says so); the list itself is on the device like every calendar. Subscribing is `calendarList.insert`, removing it
  `calendarList.delete`, in the person's own Google list. The choice is per person.

  Background:
    Given today is 2026-12-20
    And "jo@example.com" and "anna@example.com" may use the calendar
    And "jo@example.com" has the calendar "Jo" and the shared calendar "Family"
    And "jo@example.com" is signed in

  Scenario: The Holidays section starts with the Add region row
    When I open the settings
    And I open the settings group "Calendars"
    Then the Holidays section lists no holiday calendar
    And the settings page shows the setting "Add region"

  Scenario: Adding a region lists its calendar under Holidays
    Given Google's holiday calendar of "Germany" has the holiday "Christmas Day" on 2026-12-25
    When I open the settings
    And I open the settings group "Calendars"
    And I open the holiday region picker
    And I search the holiday regions for "germ"
    Then the holiday regions offer "Germany"
    And the holiday regions do not offer "Austria"
    When I add the holiday region "Germany" as "Public holidays only"
    Then the Holidays section lists the holiday calendar "Holidays in Germany"
    When I leave the settings
    And I open the week view for 2026-12-21
    Then I see the event "Christmas Day" on 2026-12-25

  Scenario: A region with one variant needs no question
    Given Google knows only the public holidays of "Austria"
    When I open the settings
    And I open the settings group "Calendars"
    And I open the holiday region picker
    And I search the holiday regions for "austria"
    And I add the holiday region "Austria" without a question
    Then the Holidays section lists the holiday calendar "Holidays in Austria"

  Scenario: A region Google does not know is not offered
    Given Google has no holiday calendar for "Austria"
    When I open the settings
    And I open the settings group "Calendars"
    And I open the holiday region picker
    And I search the holiday regions for "austria"
    Then the holiday regions do not offer "Austria"

  Scenario: A variant that is already added is not offered again
    Given "jo@example.com" has added the holiday region "Germany" as "Public holidays only"
    When I open the settings
    And I open the settings group "Calendars"
    And I open the holiday region picker
    And I search the holiday regions for "germ"
    Then the holiday regions offer "Germany"
    When I choose the holiday region "Germany"
    Then the holiday variants offered are "Holidays and observances"

  Scenario: A holiday calendar switches off and recolours like any calendar
    Given "jo@example.com" has added the holiday region "Germany" as "Public holidays only"
    And Google's holiday calendar of "Germany" has the holiday "Christmas Day" on 2026-12-25
    When I open the settings
    And I open the settings group "Calendars"
    And I open the calendar "Holidays in Germany" in the settings
    Then the settings page shows the setting "Color"
    When I switch the calendar off in its settings page
    And I leave the settings
    Then I do not see the event "Christmas Day" on 2026-12-25

  Scenario: Removing a region removes its calendar
    Given "jo@example.com" has added the holiday region "Germany" as "Public holidays only"
    And Google's holiday calendar of "Germany" has the holiday "Christmas Day" on 2026-12-25
    When I open the settings
    And I open the settings group "Calendars"
    And I open the calendar "Holidays in Germany" in the settings
    And I remove the holiday calendar
    Then the Holidays section lists no holiday calendar
    And "jo@example.com" no longer has the holiday region "Germany" in Google
    When I leave the settings
    And I open the week view for 2026-12-21
    Then I do not see the event "Christmas Day" on 2026-12-25

  Scenario: Another user keeps their own holiday calendars
    Given "jo@example.com" has added the holiday region "Germany" as "Public holidays only"
    When I switch to another device
    And "anna@example.com" signs in with Google
    And I open the settings
    And I open the settings group "Calendars"
    Then the Holidays section lists no holiday calendar

  # unit: server/test/holidays.test.ts:subscribes the id in the app language and falls back to English
  @unit
  Scenario: The calendar's language follows the app language
    When a person with the app language German adds the region "Germany" as public holidays only
    Then Google's list gets "de.german.official#holiday@group.v.calendar.google.com"

  # unit: web/test/holiday-regions.test.ts:searches region names in the app language
  @unit
  Scenario: The picker searches country names in the app language
    Given the app language is German
    When I search the holiday regions for "Öster"
    Then the holiday regions offer "Österreich"

  # unit: web/test/holiday-regions.test.ts:says adding needs a connection
  @unit
  Scenario: Adding and removing say they need a connection
    Given the device is offline
    When I open the holiday region picker
    Then the sheet says that adding a region needs a connection
