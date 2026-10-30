@api @privacy @id:privacy
Feature: The privacy page says who sees what
  The app has a privacy page for the people the operator invites. Anyone can read it, also before signing in (Google
  asks for it when the app is set up), and it is a page of its own, not part of the calendar. It names every outside
  party that gets to see something, and what it sees: Google for sign-in and the calendar, and, only when a person looks
  at a map or searches for a place on an event, a map picture service and a place search that the person's own device
  asks directly, not the server. Nobody else gets anything; there is no advertising, no tracking and no analytics.

  Rule: The page is open to everybody and is its own page

    Scenario: The privacy page can be read without signing in
      Given "jo@example.com" may use the calendar
      When I request "GET /privacy.html"
      Then the response status is 200
      And the response text contains "Privacy policy"

    Scenario: The privacy page is not replaced by the calendar
      When I open the path "/privacy.html"
      Then the page is the privacy policy
      And the calendar is not shown

  Rule: The page names the outside parties and what each sees

    Scenario: Google sees the account and the calendar data
      When I request "GET /privacy.html"
      Then the privacy policy names "Google" and says what it sees: "email address, Google Calendar, Google Drive"

    Scenario: The map picture service sees the device's address
      When I request "GET /privacy.html"
      Then the privacy policy names the map picture service and says what it sees: "IP address"
      And the privacy policy says the device, not the server, asks it

    Scenario: The place search sees the device's address and what is typed
      When I request "GET /privacy.html"
      Then the privacy policy names the place search and says what it sees: "IP address, text you type"
      And the privacy policy says the device, not the server, asks it

    Scenario: Nobody else gets anything
      When I request "GET /privacy.html"
      Then the privacy policy says there is no advertising, tracking or analytics
      And the privacy policy says the only outside parties are Google and the two map services
