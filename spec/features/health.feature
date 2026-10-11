@api
Feature: Health and configuration endpoints
  Scenarios tagged @smoke use no test-only steps and also run against the deployment
  (E2E_BASE_URL=http://cal.mordor.local, later the HTTPS URL) where TEST_MODE is off.

  @smoke
  Scenario: The health endpoint reports ok
    When I request "GET /api/health"
    Then the response status is 200
    And the response JSON field "status" equals "ok"
    And the response JSON field "providerStatus" equals "ok"

  @smoke
  Scenario: The app loads and shows the month view
    When I open the app
    Then the month view is shown
    And the page links a web app manifest

  @smoke
  Scenario: Deep links are served by the single-page app
    When I open the path "/week/2026-10-12"
    Then the week view is shown

  @smoke
  Scenario: The config endpoint exposes the week start and time zone
    When I request "GET /api/config"
    Then the response status is 200
    And the response JSON field "weekStartsOn" equals "1"
    And the response JSON field "timeZone" equals "Europe/Berlin"

  Scenario: The config endpoint honours the test clock
    Given today is 2026-10-12
    When I request "GET /api/config"
    Then the response JSON field "now" equals "2026-10-12T06:00:00.000Z"
    And the response JSON field "clockFrozen" equals "true"

  Scenario: Health reports an unavailable provider without failing
    Given Google becomes unavailable
    When I request "GET /api/health"
    Then the response status is 200
    And the response JSON field "providerStatus" equals "unavailable"
