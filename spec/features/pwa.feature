@pwa
Feature: Installable progressive web app
  The app is installable on Android (Chrome) and iOS (Safari, "Add to Home Screen").
  Service workers and the Android install prompt need a secure context: they work on
  http://localhost (tests) and in production only once the app is served over HTTPS.
  Over plain http://cal.mordor.local the app must still work, just without a service worker.

  Background:
    Given the calendar is empty
    And today is 2026-10-12

  Scenario: The page links a valid web app manifest
    When I open the app
    Then the page links a web app manifest
    When I request "GET /manifest.webmanifest"
    Then the response status is 200
    And the response JSON field "name" equals "Calendar"
    And the response JSON field "short_name" equals "Calendar"
    And the response JSON field "display" equals "standalone"
    And the response JSON field "start_url" equals "/"
    And the response JSON field "scope" equals "/"
    And the response JSON field "theme_color" equals "#1a73e8"
    And the response JSON field "background_color" equals "#ffffff"
    And the manifest declares an icon of size "192x192"
    And the manifest declares an icon of size "512x512"
    And the manifest declares a maskable icon
    And every manifest icon can be downloaded as a PNG

  Scenario: iOS home screen meta tags are present
    When I open the app
    Then the page has a theme color
    And the page has an apple touch icon of size "180x180"
    And the page has the meta tag "apple-mobile-web-app-capable" set to "yes"
    And the page has the meta tag "apple-mobile-web-app-status-bar-style" set to "default"
    And the page has the meta tag "apple-mobile-web-app-title" set to "Calendar"
    And the viewport meta tag contains "viewport-fit=cover"

  Scenario: A service worker is registered in a secure context
    When I open the app
    Then a service worker is registered for scope "/"

  Scenario: The app shell loads offline after the first visit
    When I open the app
    And a service worker is registered for scope "/"
    And the service worker controls the page
    And the network connection is lost
    And I reload the page
    Then the month view is shown
    And I see the sync error banner

  Scenario: API requests are never served from the service worker cache
    Given the calendar contains an event "Dentist" on 2026-10-14 from 09:00 to 10:00
    When I open the week view for 2026-10-12
    And the service worker controls the page
    And Google renames the event "Dentist" to "Orthodontist"
    And I reload the page
    Then I see the event "Orthodontist" on 2026-10-14

  @android
  Scenario: Android shows an in-app install button when the browser offers installation
    When I open the app
    Then I do not see the install app button
    When the browser offers to install the app
    Then I see the install app button
    When I click the install app button
    Then the browser install prompt was shown

  @ios
  Scenario: iOS Safari shows an "Add to Home Screen" hint
    Given I am using Safari on an iPhone
    When I open the app
    Then I see the iOS install hint "Tap Share, then Add to Home Screen"
    When I dismiss the iOS install hint
    Then I do not see the iOS install hint
    When I reload the page
    Then I do not see the iOS install hint

  @ios
  Scenario: No install hint when already running as an installed app
    Given I am using Safari on an iPhone
    And the app runs as an installed app
    When I open the app
    Then I do not see the iOS install hint
    And I do not see the install app button

  @ios
  Scenario: An iPhone user sees how to install the app
    Given I am using Safari on an iPhone
    When I open the path "/settings"
    Then the settings offer to install the app
    When I open the install instructions in the settings
    Then the install instructions show the steps "Tap the Share button, Choose Add to Home Screen, Tap Add"
    And the add button covers no control of the "install sheet"
    When I close the install instructions
    Then the install instructions are closed

  @ios
  Scenario: The settings offer no install row when the app is already installed
    Given I am using Safari on an iPhone
    And the app runs as an installed app
    When I open the path "/settings"
    Then the settings do not offer to install the app

  Scenario: The settings offer no iOS install row on other devices
    When I open the path "/settings"
    Then the settings do not offer to install the app

  Scenario: No iOS hint on other browsers
    When I open the app
    Then I do not see the iOS install hint

  Scenario: A new build offers a reload
    When I open the week view for 2026-10-12
    And a new version of the app is deployed
    And the app syncs
    Then I am told a new version is available
    When I choose to reload
    Then the app runs the new version

