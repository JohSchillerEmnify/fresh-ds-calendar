@search @id:item-search @area:views
Feature: Search the calendar for events and task lists
  Owner, issue 190: "kalender should have a search to look for items." The owner's later picks and
  decisions are listed in .requirements/*_item_search/REQUIREMENTS.md; what that file marks as a proposal is not decided.
  The list updates on every keystroke with no wait (owner); only the search beyond the device below is a request.
  Proposal: a search button in the top bar (date, search, Today, filter, settings) opens a search sheet. While I type it lists the events and the task lists
  (and their items) that contain all my words in the title, the notes, the place or an item, from the copy on this
  device, so it also works without a connection. Capitals, accents and hyphens do not matter, and close spellings
  match too (owner: "Typos allowed", e.g. "advsor" finds "advisor"): one typo is forgiven in words of four letters or
  more; a word of three letters matches the start of a word ("tea" finds "team") but "tem" finds nothing (proposal on top of the owner's pick "MiniSearch, typos from 4 letters (Recommended)"). Birthdays and holidays are found like events;
  events of calendars I switched off are found too and carry a "hidden" mark; shared lists carry their "shared" mark
  (owner picks). Upcoming comes first (owner). The list shows the first screenful and loads more while I scroll. Handwritten items have no text and are never matched: their list is found by its title only
  (the spec says so: G3 in handwritten-lists.feature). Choosing a result opens that event or list on its day.
  The device copy reaches from a year back to a year ahead of today for events and holds all task lists (ADR 0025;
  the code keeps today-365 up to, not including, today+366, `windowOf` in `web/src/lib/deviceData.ts`), so that is what the search covers
  first; the sheet says so. Owner decisions 18 and 19: there is no button. When I am online and scroll to the end of
  the device results, the search goes on by itself over all dates (Google's own text search, events only, the 100
  nearest to today first, then 100 more at each further scroll to the end); offline the end of the list says the rest
  needs a connection. Nothing is silent (owner: "but not silently, we need to tell user"): the list says what the
  device reached, that it is searching all dates, what it searched, and when results are cut. Beyond the device only
  Google's matching applies; whether it forgives typos is unverified until tested against Google.

  Background:
    Given the calendar is empty
    And today is 2026-11-26

  Rule: The search is reached from the top bar

    @mobile
    Scenario: The top bar has a search button that opens the search as a bottom sheet
      When I open the day view for 2026-11-26
      Then the top bar shows the search button
      When I open the item search
      Then the item search is open
      And the item search is shown as a bottom sheet

    @mobile
    Scenario: The search button sits right after the date, before Today (owner, on the mockup)
      When I open the day view for 2026-11-26
      Then the search button is right after the date and before the Today button

    # owner pick "Top bar icon (Recommended)": with the side menu the bar holds no search button, the menu has a search row at its top
    @mobile
    Scenario: With the side menu the search is a row at the top of the menu
      Given the view switcher on phones is set to "side menu"
      When I open the day view for 2026-11-26
      Then the top bar shows no search button
      When I open the side menu
      Then the side menu has the search row at its top
      When I choose the search row in the side menu
      Then the item search is open
      And the side menu is closed

    @desktop
    Scenario: On a large screen the search opens as a dialog
      When I open the day view for 2026-11-26
      And I open the item search
      Then the item search is shown as a dialog

    Scenario: Escape closes the search
      When I open the day view for 2026-11-26
      And I open the item search
      And I press Escape
      Then the item search is closed

  Rule: The search looks at titles, notes, places and task items

    Scenario: An event is found by its title
      Given the calendar contains an event "Dentist" on 2026-12-03 from 09:00 to 10:00
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "dentist"
      Then the item search shows the event "Dentist" on 2026-12-03

    Scenario: An event is found by its notes
      Given the calendar "Personal" contains an event "Check-up" on 2026-12-03 from 09:00 to 10:00 at "Rosenstrasse 4" with the description "bring the insurance card"
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "insurance"
      Then the item search shows the event "Check-up" on 2026-12-03

    Scenario: An event is found by its place
      Given the calendar "Personal" contains an event "Check-up" on 2026-12-03 from 09:00 to 10:00 at "Rosenstrasse 4" with the description "bring the insurance card"
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "rosenstrasse"
      Then the item search shows the event "Check-up" on 2026-12-03

    Scenario: A task list is found by its title
      Given the calendar contains a task list "Packing" on 2026-12-05 with items:
        | item      | done  |
        | Passport | no   |
        | Charger | no   |
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "pack"
      Then the item search shows the task list "Packing" on 2026-12-05

    Scenario: A task list is found by one of its items and the result names that item
      Given the calendar contains a task list "Packing" on 2026-12-05 with items:
        | item      | done  |
        | Passport | no   |
        | Charger | no   |
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "passport"
      Then the item search shows the item "Passport" of the task list "Packing"

    Scenario: An undated task list is found too
      Given the calendar contains an undated task list "Taxes" with items:
        | item      | done  |
        | Receipts | no   |
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "taxes"
      Then the item search shows the undated task list "Taxes"

    Scenario: A finished task list is found too
      Given the calendar contains a task list "Old move" finished on 2026-10-10 with the item "Boxes"
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "boxes"
      Then the item search shows the item "Boxes" of the task list "Old move"

    # Proposal: follows the spec's G3 in handwritten-lists.feature; not an owner decision of issue 190.
    Scenario: A handwritten list is found by its title but not by its ink placeholder
      Given the Labs switch "Handwritten lists" is on
      And the calendar contains a task list "Groceries" on 2026-12-01 with the ink items "Milk, Eggs"
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "groceries"
      Then the item search shows the task list "Groceries" on 2026-12-01
      When I search the items for "handwritten"
      Then the item search says nothing matches "handwritten"

  Rule: Matching ignores capitals and accents, forgives typos and needs every word

    Scenario: Capitals and accents do not matter
      Given the calendar contains an event "Café Anna" on 2026-12-02 from 15:00 to 16:00
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "CAFE"
      Then the item search shows the event "Café Anna" on 2026-12-02

    Scenario: A small typo still finds the event
      Given the calendar contains an event "Advisor meeting" on 2026-12-02 from 15:00 to 16:00
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "advsor"
      Then the item search shows the event "Advisor meeting" on 2026-12-02

    Scenario: A typo in a word of four letters is forgiven
      Given the calendar contains an event "Team lunch" on 2026-12-04 from 12:00 to 13:00
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "teem"
      Then the item search shows the event "Team lunch" on 2026-12-04

    Scenario: A word of three letters matches the start of a word but forgives no typo
      Given the calendar contains an event "Team lunch" on 2026-12-04 from 12:00 to 13:00
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "tea"
      Then the item search shows the event "Team lunch" on 2026-12-04
      When I search the items for "tem"
      Then the item search says nothing matches "tem"

    Scenario: Every word forgives a typo on its own
      Given the calendar contains an event "Team lunch" on 2026-12-04 from 12:00 to 13:00
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "lunsh team"
      Then the item search shows the event "Team lunch" on 2026-12-04

    Scenario: A word that is far from every text finds nothing
      Given the calendar contains an event "Dentist" on 2026-12-03 from 09:00 to 10:00
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "doctor"
      Then the item search says nothing matches "doctor"

    Scenario: Every word must be found, in any order
      Given the calendar contains an event "Team lunch" on 2026-12-04 from 12:00 to 13:00
      And the calendar contains an event "Team meeting" on 2026-12-04 from 14:00 to 15:00
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "lunch team"
      Then the item search shows 1 result
      And the item search shows the event "Team lunch" on 2026-12-04

    Scenario: Nothing matches
      Given the calendar contains an event "Dentist" on 2026-12-03 from 09:00 to 10:00
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "xylophone"
      Then the item search says nothing matches "xylophone"

    Scenario: Clearing the field empties the list
      Given the calendar contains an event "Dentist" on 2026-12-03 from 09:00 to 10:00
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "dentist"
      And I clear the item search
      Then the item search shows 0 results

  Rule: The search covers what the device keeps

    Scenario: Events from a year back to a year ahead are found on the device, older and later ones are not
      Given the calendar contains an event "Tax advice" on 2025-12-01 from 10:00 to 11:00
      And the calendar contains an event "Tax return 2024" on 2025-10-01 from 10:00 to 11:00
      And the calendar contains an event "Tax audit" on 2027-11-01 from 10:00 to 11:00
      And the calendar contains an event "Tax outlook" on 2027-12-15 from 10:00 to 11:00
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "tax"
      Then the item search lists "Tax audit, Tax advice"
      And the item search says it covers 2025-11-26 to 2027-11-26

    Scenario: The search works without a connection
      Given the calendar contains an event "Dentist" on 2026-12-03 from 09:00 to 10:00
      When I open the day view for 2026-11-26
      And the network connection is lost
      And I open the item search
      And I search the items for "dentist"
      Then the item search shows the event "Dentist" on 2026-12-03

  Rule: At the end of the device results the search goes on by itself, over all dates (owner decisions 18 and 19)

    Scenario: Online, reaching the end of the device results adds the events from beyond the device's dates
      Given the calendar contains an event "Tax advice" on 2025-12-01 from 10:00 to 11:00
      And the calendar contains an event "Tax return 2024" on 2025-10-01 from 10:00 to 11:00
      And the calendar contains an event "Tax outlook" on 2027-12-15 from 10:00 to 11:00
      And the calendar contains an event "Tax return 2019" on 2020-06-01 from 10:00 to 11:00
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "tax"
      And I scroll the item search to the end
      Then the item search lists "Tax advice, Tax outlook, Tax return 2024, Tax return 2019"
      And the item search says it searched all dates

    Scenario: The server is not asked while the device results still fill the screen
      Given the calendar contains a heavy year around 2026-11-26
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "dentist"
      Then the item search has not looked beyond the device yet

    Scenario: With 250 matches beyond the device, the nearest 100 come first and more load while scrolling
      Given the calendar contains 250 events "Tax session" one a day from 2020-01-01
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "tax"
      And I scroll the item search to the end
      Then the item search has 100 results in all
      And the item search says the nearest 100 are shown and more load while scrolling
      When I scroll the item search to the end
      Then the item search has 200 results in all
      When I scroll the item search to the end
      Then the item search has 250 results in all
      And the item search says it searched all dates

    Scenario: A result found beyond the device opens its day
      Given the calendar contains an event "Tax return 2019" on 2020-06-01 from 10:00 to 11:00
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "tax"
      And I scroll the item search to the end
      And I choose the item search result "Tax return 2019"
      Then the URL path is "/day/2020-06-01"
      And the event dialog is open

    Scenario: The search beyond the device is per person
      Given "jo@example.com" and "anna@example.com" may use the calendar
      And "anna@example.com" has an event "Tax secret" on 2020-06-01 from 10:00 to 11:00
      And "jo@example.com" is signed in
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "tax"
      And I scroll the item search to the end
      Then the item search says nothing matches "tax"

    Scenario: When Google's rate limit stops the search, the list says so and tries again on the next scroll to the end
      Given the calendar contains an event "Tax return 2019" on 2020-06-01 from 10:00 to 11:00
      And Google refuses searches because of its rate limit
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "tax"
      And I scroll the item search to the end
      Then the item search says searching all dates did not finish
      When Google accepts searches again
      And I scroll the item search to the end
      Then the item search shows the event "Tax return 2019" on 2020-06-01

    Scenario: Offline the end of the list says the rest needs a connection
      Given the calendar contains an event "Tax advice" on 2025-12-01 from 10:00 to 11:00
      When I open the day view for 2026-11-26
      And the network connection is lost
      And I open the item search
      And I search the items for "tax"
      And I scroll the item search to the end
      Then the item search lists "Tax advice"
      And the item search says the rest needs a connection

  Rule: Results come in a fixed order

    Scenario: Upcoming first, nearest first (owner); then the past, newest first; undated lists last
      Given the calendar contains an event "Run" on 2026-12-10 from 07:00 to 08:00
      And the calendar contains an event "Run" on 2026-11-30 from 07:00 to 08:00
      And the calendar contains an event "Run" on 2026-11-01 from 07:00 to 08:00
      And the calendar contains an event "Run" on 2026-09-15 from 07:00 to 08:00
      And the calendar contains an undated task list "Run plan" with items:
        | item    | done  |
        | Shoes | no   |
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "run"
      Then the item search lists "Run on 2026-11-30, Run on 2026-12-10, Run on 2026-11-01, Run on 2026-09-15, Run plan"

  Rule: Choosing a result opens that item on its day

    Scenario: Choosing an event opens its day and the event
      Given the calendar contains an event "Dentist" on 2026-12-03 from 09:00 to 10:00
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "dentist"
      And I choose the item search result "Dentist"
      Then the item search is closed
      And the URL path is "/day/2026-12-03"
      And the event dialog is open

    Scenario: Choosing a task list result opens its day and the list
      Given the calendar contains a task list "Packing" on 2026-12-05 with items:
        | item      | done  |
        | Passport | no   |
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "passport"
      And I choose the item search result "Packing"
      Then the item search is closed
      And the URL path is "/day/2026-12-05"
      And the task list "Packing" is expanded

    Scenario: Choosing an undated task list opens it in the Tasks view
      Given the calendar contains an undated task list "Taxes" with items:
        | item      | done  |
        | Receipts | no   |
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "taxes"
      And I choose the item search result "Taxes"
      Then the item search is closed
      And the Tasks view lists "Taxes"

  Rule: Calendars I have switched off are searched and marked

    Scenario: An item of a hidden calendar is found and marked hidden
      Given the calendar contains an event "Standup" in the calendar "Work" on 2026-12-03 from 09:00 to 09:15
      And the calendar contains an event "Standup notes" on 2026-12-04 from 09:00 to 09:15
      When I open the day view for 2026-11-26
      And I show the filters
      And I hide the calendar "Work" in the filter bar
      And I open the item search
      And I search the items for "standup"
      Then the item search shows the event "Standup" on 2026-12-03
      And the item search marks the result "Standup" as hidden
      And the item search does not mark the result "Standup notes" as hidden

  Rule: Birthdays and holidays are found like events

    Scenario: A birthday is found
      Given the Birthdays calendar has a birthday "Anna" on 2026-12-20
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "anna"
      Then the item search shows the event "Anna" on 2026-12-20

    Scenario: A holiday is found
      Given "jo@example.com" and "anna@example.com" may use the calendar
      And "jo@example.com" is signed in
      And Google's holiday calendar of "Germany" has the holiday "Christmas Day" on 2026-12-25
      And "jo@example.com" has added the holiday region "Germany" as "Public holidays only"
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "christmas"
      Then the item search shows the event "Christmas Day" on 2026-12-25

  Rule: Lists shared with me are searched like my own and marked shared

    Scenario: A shared list and its items are found by the person it is shared with
      Given "jo@example.com", "anna@example.com" and "bob@example.com" may use the calendar
      And "jo@example.com" has an undated task list "Groceries" with the items "Milk, Eggs"
      And "jo@example.com" is signed in
      And I share the task list "Groceries" with "anna@example.com" who accepts
      When "anna@example.com" opens the Tasks view on another device
      And I open the item search
      And I search the items for "eggs"
      Then the item search shows the shared task list "Groceries"
      And the item search shows the item "Eggs" of the task list "Groceries"

  Rule: The search sheet looks as drawn, light and dark

    @visual @mobile
    Scenario Outline: The sheet empty, with results and with no match
      Given the device prefers a <scheme> color scheme
      And the calendar "Personal" contains an event "Lunch with Anna" on 2026-12-03 from 12:00 to 13:00 at "Cafe Rosa" with the description "bring the gift"
      And the calendar contains a task list "Packing" on 2026-12-05 with items:
        | item     | done |
        | Lunch box | no   |
      When I open the day view for 2026-11-26
      And I open the item search
      Then the "item search" still looks like "item-search-empty-<scheme>"
      When I search the items for "lunch"
      Then the item search says it searched all dates
      And the "item search" still looks like "item-search-results-<scheme>"
      When I search the items for "xylophone"
      Then the item search says nothing matches "xylophone"
      And the "item search" still looks like "item-search-none-<scheme>"

      Examples:
        | scheme |
        | light  |
        | dark   |

    @visual @desktop
    Scenario: The dialog with results on a large screen
      Given the calendar "Personal" contains an event "Lunch with Anna" on 2026-12-03 from 12:00 to 13:00 at "Cafe Rosa" with the description "bring the gift"
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "lunch"
      Then the item search says it searched all dates
      And the "item search" still looks like "item-search-results-dialog"

  @perf
  Rule: The search is reasonably fast on a phone with a heavy user's data (owner: "it should be reasonably performant")

    Background:
      Given the calendar contains a heavy year around 2026-11-26
      And the seasons and holidays are off

    Scenario: Typing a query on a slow phone shows results on every keystroke, quickly, and never freezes the page
      When I open the day view for 2026-11-26
      And I open the item search
      And the phone's processor is 4 times slower
      And I start measuring long tasks
      And I search the items for "lunch team" and the results appear within 500 ms
      And I search the items for "dentist" and the results appear within 500 ms
      Then no task blocked the page for more than 300 ms
      And the long tasks took at most 1000 ms together

    Scenario: Opening the search for the first time builds its index in small steps without freezing the page
      When I open the day view for 2026-11-26
      And the phone's processor is 4 times slower
      And I start measuring long tasks
      And I open the item search
      And I search the items for "dentist" and the results appear within 1500 ms
      Then no task blocked the page for more than 300 ms
      And the long tasks took at most 1000 ms together

    Scenario: Opening and closing the search again and again does not leak memory
      When I open the day view for 2026-11-26
      And I open and close the item search 10 times
      And I record the browser memory after garbage collection
      And I open and close the item search 50 times
      Then the JS heap has grown by less than 15 percent since the recording
      And the DOM node count has grown by less than 10 percent since the recording

    Scenario: A query with hundreds of matches shows the first screenful and loads more while scrolling
      When I open the day view for 2026-11-26
      And I open the item search
      And I search the items for "dentist"
      Then the item search shows at most 30 results
      When I scroll the item search to the end
      Then the item search shows more than 30 results
