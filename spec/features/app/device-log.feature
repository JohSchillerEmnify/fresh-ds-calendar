@settings @id:device-log
Feature: An error log on this device that I can send
  Whenever something goes wrong the app writes a short entry into an error log kept on this device: errors nobody caught,
  failed requests and changes the server did not take (method, route, status, error code, what the response looked
  like and what the app decided), service worker and sync failures. Each entry has the time, the app version and the
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
