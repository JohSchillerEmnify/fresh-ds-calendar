@perf @id:resource-efficiency
Feature: Resource efficiency and no memory leaks
  Hard requirements. Browser memory is measured after a forced garbage collection, and only after every workload
  of the scenario ran a few times as warm-up, so first-use code and caches are not counted as growth (owner); the node count settles after the second pass
  through the workloads (a one-time step of about 600 nodes, then flat over 100 more view cycles), so the warm-up runs twice;
  the JS heap leaves out V8's compiled code, which keeps growing for hundreds of cycles while the JIT tiers up (+1.8 MB over
  250 cycles; objects and arrays +45 KB, once; with the JIT off the heap stays flat); server memory through the test-only memory endpoint. These scenarios run only at the
  phone viewport, serially.

  Background:
    Given the calendar is empty
    And today is 2026-10-12
    And the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    And the calendar contains a task list "Groceries" on 2026-10-14 with items:
      | item | done |
      | Milk | no   |
      | Eggs | yes  |
    And the seasons and holidays are off

  Scenario: Switching views and opening dialogs repeatedly does not leak memory
    When I open the month view for 2026-10
    And I cycle through the month, week and day views 10 times
    And I open and close the event dialog 10 times
    And I expand and collapse the task list "Groceries" 10 times
    And I cycle through the month, week and day views 10 times
    And I open and close the event dialog 10 times
    And I expand and collapse the task list "Groceries" 10 times
    And I record the browser memory after garbage collection
    And I cycle through the month, week and day views 50 times
    And I open and close the event dialog 50 times
    And I expand and collapse the task list "Groceries" 50 times
    Then the JS heap has grown by less than 15 percent since the recording
    And the DOM node count has grown by less than 10 percent since the recording
    And the event listener count has grown by less than 10 percent since the recording
    And there are no detached DOM nodes from closed dialogs

  Scenario: Navigating many periods does not accumulate polling timers
    Given automatic sync runs every 2 seconds
    When I open the week view for 2026-10-12
    And I go to the next period 20 times
    And I count requests to "/api/changes" for 10 seconds
    Then at most 6 requests to "/api/changes" were counted

  Scenario: Polling stops while the app is hidden
    Given automatic sync runs every 2 seconds
    When I open the week view for 2026-10-12
    And the app is hidden
    And I count requests to "/api/changes" for 6 seconds
    Then at most 0 requests to "/api/changes" were counted

  Scenario: The first load stays within the JavaScript budget
    220 KB compressed (owner: 2026-10-23 raised from 150 to 200; 2026-11-10 raised to 220 for the new icon sets and the
    credits list). A ceiling, not a target; well under the 1 MB that would matter.
    When I open the app
    Then the JavaScript downloaded for the first load is at most 220 KB compressed
    And the month view was rendered within 2000 ms of navigation start

  @month
  Scenario: A busy month renders and swipes smoothly
    The owner has a lot of appointments (2026-10-24): 6 to 15 events a day, a task list every other day, all-day and
    multi-day events and birthdays, about 500 entries in the six weeks of the grid. A phone processor is about 4 times
    slower than this machine. Measured here before -> after the fix (quiet machine, 4 runs each): longest task 436-511 ->
    380-416 ms, long tasks together 2064-2393 -> 1784-2069 ms; on a busy machine the fixed app reached 665 ms and 3106 ms.
    The budgets guard against regressions (a month that freezes the phone for seconds), with room for a busy machine.
    Given the calendar contains a busy month around 2026-10
    When I open the month view for 2026-10
    And the phone's processor is 4 times slower
    And I start measuring long tasks
    And I go to the next period
    And I go to the previous period
    And I swipe left on the calendar
    Then no task blocked the page for more than 800 ms
    And the long tasks took at most 3500 ms together

  Scenario: Returning to the calendar after a hidden period syncs once and resumes polling
    Given automatic sync runs every 2 seconds
    When I open the week view for 2026-10-12
    And the app is hidden
    And the app regains focus
    And I count requests to "/api/changes" for 5 seconds
    Then at most 4 requests to "/api/changes" were counted
    And at least 2 requests to "/api/changes" were counted

  Scenario: The app scores well in a phone performance audit
    When I run a phone performance audit of the app 3 times
    Then the median performance score is at least 70

  Scenario: The server stays small when idle
    When I request "GET /api/__test/memory?gc=true" on a fresh server
    Then the server resident memory is below 100 MB

  Scenario: The server does not leak memory under load
    When I send 500 warm-up requests to "GET /api/items?from=2026-09-28&to=2026-11-02"
    And I record the server memory after garbage collection
    And I send 5000 requests to "GET /api/items?from=2026-09-28&to=2026-11-02"
    And I send 500 requests to "PATCH" the item "Milk" of the task list "Groceries" alternating done and not done
    Then the server memory has grown by less than 20 MB since the recording

  Scenario: Reward effects and drag and drop leave nothing behind
    When I open the day view for 2026-10-14
    And I expand the task list "Groceries"
    And I tick and untick the item "Milk" 10 times
    And I collapse the task list
    And I drag the event "Dentist" back and forth 5 times
    And I record the browser memory after garbage collection
    And I expand the task list "Groceries"
    And I tick and untick the item "Milk" 50 times
    And I collapse the task list
    And I drag the event "Dentist" back and forth 20 times
    Then there are no reward effect elements left
    And the JS heap has grown by less than 15 percent since the recording
    And the DOM node count has grown by less than 10 percent since the recording
    And the event listener count has grown by less than 10 percent since the recording

  Scenario: The live clock uses one timer and pauses while hidden
    Given the time is 2026-10-12 09:20 and the clock is running
    When I open the day view for 2026-10-12
    And I cycle through the month, week and day views 10 times
    Then at most 2 app timers are active
