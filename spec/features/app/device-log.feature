@settings @id:device-log
Feature: An error log on this device that I can send
  Whenever something goes wrong the app writes a short entry into an error log kept on this device: errors nobody caught,
  failed requests and changes the server did not take (method, route, status, error code, what the response looked
  like and what the app decided), every change the app put back after a refusal (a calendar colour, a setting, a task
  item...) and every sync answer that replaced a calendar setting I had just changed on this device, service worker and sync failures. Each entry has the time, the app version and the
  platform. The log keeps the last 500 entries and survives a reload.
  It never holds personal data: no titles, item texts, e-mail addresses, tokens or request bodies, and ids are left out
  of routes. It leaves the device only when I copy, share or download it under Settings › Error log.

  Background:
    Given the calendar is empty
    And the time is 2026-10-12 08:12

  Scenario: A change the server refused is in the error log without its title
    Given the calendar contains an event "Dentist Meyer" on 2026-10-13 from 10:00 to 11:00
    And I have seen the week view for 2026-10-12
    And the server refuses the next change as invalid
    When I open the event "Dentist Meyer"
    And I delete the event
    And the undo time is over
    Then I am told that the change to "Dentist Meyer" was not saved because the server refused it
    When I open the error log in the settings
    Then the error log has an entry "DELETE /api/events/:id 400 VALIDATION_ERROR"
    And the error log has an entry "event.delete refused"
    And the error log does not contain "Dentist"

  Scenario: A refused-change notice that stays covers no row of the settings
    Given the calendar contains an event "Dentist Meyer" on 2026-10-13 from 10:00 to 11:00
    And I have seen the week view for 2026-10-12
    And the server refuses the next change as invalid
    When I open the event "Dentist Meyer"
    And I delete the event
    And the undo time is over
    Then I am told that the change to "Dentist Meyer" was not saved because the server refused it
    When I open the settings
    And I scroll the settings to the end
    Then the notice covers no row of the settings

  Scenario: A calendar colour the server refused is in the error log as rolled back
    Given "jo@example.com" and "anna@example.com" may use the calendar
    And "jo@example.com" has the calendar "Jo" and the shared calendar "Family"
    And "jo@example.com" is signed in
    And the server refuses the next change as invalid
    When I try to recolour the calendar "Jo" to the palette colour 8
    And I leave the settings
    And I open the error log in the settings
    Then the error log has an entry "calendar colour rolled back PATCH /api/calendars/:id"
    And the error log has an entry "VALIDATION_ERROR"

  # A sync answer that crosses a just-saved colour needs a race the browser suite cannot stage.
  # unit: web/test/app-decisions.test.ts:reports a sync answer that replaces a setting set on this device less than 2 minutes ago
  @unit
  Scenario: A sync answer that replaces a calendar colour I just set is in the error log
    Given I set the colour of the calendar "Jo" 12 seconds ago
    When a sync answer brings back the old colour of the calendar "Jo"
    And I open the error log in the settings
    Then the error log has an entry "sync replaced calendar colour set on this device 12 s ago"
    And the error log does not contain "Jo"

  Scenario: An error nobody caught is logged and kept after a reload
    Given I have seen the week view for 2026-10-12
    When an unexpected error "boom in the week view" happens in the app
    And I reload the app
    And I open the error log in the settings
    Then the error log has an entry "TypeError: boom in the week view"

  Scenario: The newest entry comes first and Clear empties the log
    Given this device's error log holds:
      | at               | message                  |
      | 2026-10-12 08:01 | Error: sync stopped      |
      | 2026-10-12 08:05 | Error: worker not loaded |
    When I open the error log in the settings
    Then the error log shows "Error: worker not loaded, Error: sync stopped"
    When I clear the error log
    Then the error log is empty

  Scenario: Download saves the log as a JSON file
    Given this device's error log holds:
      | at               | message                  |
      | 2026-10-12 08:01 | Error: sync stopped      |
      | 2026-10-12 08:05 | Error: worker not loaded |
    When I open the error log in the settings
    And I download the error log
    Then the downloaded error log holds 2 entries

  Scenario: Share downloads the log where the device cannot share files
    Given this device cannot share files
    And this device's error log holds:
      | at               | message                  |
      | 2026-10-12 08:01 | Error: sync stopped      |
      | 2026-10-12 08:05 | Error: worker not loaded |
    When I open the error log in the settings
    And I share the error log
    Then the downloaded error log holds 2 entries

  Scenario: Share hands the log to the share sheet as a text file
    Given this device shares only text files
    And this device's error log holds:
      | at               | message                  |
      | 2026-10-12 08:01 | Error: sync stopped      |
      | 2026-10-12 08:05 | Error: worker not loaded |
    When I open the error log in the settings
    And I share the error log with the share sheet
    Then the shared error log is a text file with 2 entries

  # The Android app has no Web Share and ignores blob downloads: its native share sheet needs the app's plugins.
  # unit: web/test/error-log-view.test.ts:copies the log and says so when the app cannot open its share sheet
  @unit
  Scenario: Share copies the log when the app cannot open its share sheet
    Given the app cannot open its share sheet
    And this device's error log holds:
      | at               | message             |
      | 2026-10-12 08:01 | Error: sync stopped |
    When I open the error log in the settings
    And I share the error log
    Then the error log is copied and I am told so

  # Native crashes never reach the web app's own handlers: the Android app writes them to a file before the process dies.
  # unit: android/app/src/test/java/lan/mordor/calendar/crash/CrashRecorderTest.java:recordsTheExceptionClassAndFramesOfACrashWithoutItsMessage
  @unit
  Scenario: A crash of the Android app is recorded without its message text
    Given the Android app crashes with "java.lang.IllegalStateException" and the message "Dentist Meyer"
    When the Android app is started again
    And I open the error log in the settings
    Then the error log has an entry "crash java.lang.IllegalStateException"
    And the error log does not contain "Dentist"

  # unit: android/app/src/test/java/lan/mordor/calendar/crash/ExitReasonReaderTest.java:reportsCrashesAndANRsSinceTheLastStartOnce
  @unit
  Scenario: An app-not-responding or native crash that Android reports is in the error log once
    Given Android 11 reports that the app stopped with an ANR and a native crash since the last start
    When the Android app is started twice
    And I open the error log in the settings
    Then the error log has an entry "crash ANR"
    And the error log has an entry "crash CRASH_NATIVE"
    And the error log holds each of them once

  Scenario: A crash record from the Android app is a crash entry in the error log
    Given the Android app recorded a crash "java.lang.IllegalStateException" with the message "Dentist Meyer" before this start
    When I open the error log in the settings
    Then the error log has an entry "crash java.lang.IllegalStateException"
    And the error log does not contain "Dentist"

  Scenario: Send to server uploads the log and says so
    Given this device's error log holds:
      | at               | message                  |
      | 2026-10-12 08:01 | Error: sync stopped      |
      | 2026-10-12 08:05 | Error: worker not loaded |
    When I open the error log in the settings
    And I send the error log to the server
    Then I am told the error log was sent
    And the server holds 1 error log upload for me with 2 entries

  Scenario: Send to server offline says it could not be sent and keeps the log
    Given this device's error log holds:
      | at               | message             |
      | 2026-10-12 08:01 | Error: sync stopped |
    When I open the error log in the settings
    And this device is offline
    And I send the error log to the server
    Then I am told the error log could not be sent
    And the error log has an entry "Error: sync stopped"

  # unit: server/test/diag-device-log.test.ts:keeps the last 5 uploads per person, refuses over 256 KB and rate-limits
  @unit
  Scenario: The server keeps a few uploads per person and refuses oversized or too frequent ones
    Given "jo@example.com" and "anna@example.com" may use the calendar
    When "jo@example.com" sends 7 error logs
    Then the server holds 5 error log uploads for "jo@example.com" and none for "anna@example.com"
    And an error log over 256 KB is refused
    And a second upload within a minute is refused

  Scenario: Sending reports automatically is off by default and nothing is sent
    Given this device's error log holds:
      | at               | message             |
      | 2026-10-12 08:01 | Error: sync stopped |
    When I open the error log in the settings
    Then sending reports automatically is off
    And the server holds no error log upload

  Scenario: Switching automatic sending on sends the new entries
    Given this device's error log holds:
      | at               | message             |
      | 2026-10-12 08:01 | Error: sync stopped |
    And the Android app recorded a crash "java.lang.IllegalStateException" with the message "Dentist Meyer" before this start
    When I open the error log in the settings
    And I switch sending reports automatically on
    Then the server holds 1 error log upload for me with 2 entries
    And the stored upload does not contain "Dentist"

  # The server's one-a-minute limit would hide a second upload in a browser run; the unit test counts the calls.
  # unit: web/test/device-log-upload.test.ts:sends nothing while the pref is off, and only entries the server does not have yet when on
  @unit
  Scenario: Automatic sending sends each entry once and stops when it is switched off
    Given sending reports automatically is on and the server has the log
    When a new error is logged
    And the app starts
    Then only the new entry is sent
    When sending reports automatically is off and another error is logged
    And the app starts
    Then nothing is sent

  @visual
  Scenario Outline: The error log page with Send to server and the automatic switch looks right in the <scheme> theme
    Given this device's error log holds:
      | at               | message                  |
      | 2026-10-12 08:01 | Error: sync stopped      |
      | 2026-10-12 08:05 | Error: worker not loaded |
    And the Android app recorded a crash "java.lang.IllegalStateException" with the message "Dentist Meyer" before this start
    And the device prefers a <scheme> color scheme
    When I open the error log in the settings
    Then the "error log page" still looks like "error-log-send-<scheme>"

    Examples:
      | scheme |
      | light  |
      | dark   |
