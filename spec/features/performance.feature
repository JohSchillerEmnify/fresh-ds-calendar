@perf
Feature: Resource efficiency and no memory leaks
  Hard requirements. Browser memory is measured after a forced garbage collection;
  server memory through the test-only memory endpoint. These scenarios run only at the
  phone viewport, serially.

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    And the calendar contains a task list "Groceries" on 2026-10-14 with items:
      | item | done |
      | Milk | no   |
      | Eggs | yes  |

  Scenario: Switching views and opening dialogs repeatedly does not leak memory
    When I open the month view for 2026-10
    And I cycle through the month, week and day views 5 times
    And I record the browser memory after garbage collection
    And I cycle through the month, week and day views 50 times
    And I open and close the event dialog 50 times
    And I expand and collapse the task list "Groceries" 50 times
    Then the JS heap has grown by less than 10 percent since the recording
    And the DOM node count has grown by less than 10 percent since the recording
    And the event listener count has grown by less than 10 percent since the recording
    And there are no detached DOM nodes from closed dialogs

  Scenario: Navigating many periods does not accumulate polling timers
    Given automatic sync runs every 2 seconds
    When I open the week view for 2026-10-12
    And I go to the next period 20 times
    And I count requests to "/api/items" for 10 seconds
    Then at most 6 requests to "/api/items" were counted

  Scenario: Polling stops while the app is hidden
    Given automatic sync runs every 2 seconds
    When I open the week view for 2026-10-12
    And the app is hidden
    And I count requests to "/api/items" for 6 seconds
    Then at most 0 requests to "/api/items" were counted

  Scenario: The first load stays within the JavaScript budget
    When I open the app
    Then the JavaScript downloaded for the first load is at most 150 KB compressed
    And the month view was rendered within 2000 ms of navigation start

  Scenario: Returning to the calendar after a hidden period syncs once and resumes polling
    Given automatic sync runs every 2 seconds
    When I open the week view for 2026-10-12
    And the app is hidden
    And the app regains focus
    And I count requests to "/api/items" for 5 seconds
    Then at most 4 requests to "/api/items" were counted
    And at least 2 requests to "/api/items" were counted

  Scenario: The app scores well in a phone performance audit
    When I run a phone performance audit of the app
    Then the performance score is at least 90

  Scenario: The server stays small when idle
    When I request "GET /api/__test/memory?gc=true"
    Then the server resident memory is below 80 MB

  Scenario: The server does not leak memory under load
    When I send 500 warm-up requests to "GET /api/items?from=2026-09-28&to=2026-11-02"
    And I record the server memory after garbage collection
    And I send 5000 requests to "GET /api/items?from=2026-09-28&to=2026-11-02"
    And I send 500 requests to "PATCH" the item "Milk" of the task list "Groceries" alternating done and not done
    Then the server memory has grown by less than 20 MB since the recording
