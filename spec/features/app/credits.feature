@settings @credits @id:credits @backlog
Feature: Credits
  The App section of Settings (Account & app), next to the version, has one "Credits" row. It opens a list of
  every library, icon set, font or asset the app ships whose licence asks for attribution: name, author,
  licence and a link. The list is generated at build time from the production dependencies plus one small
  data file for assets that npm does not describe (icon sets, scene art). It is bundled with the app,
  so it reads offline.

  Background:
    Given the calendar is empty
    And today is 2026-10-12

  Scenario: The App section has a credits row next to the version
    When I open the settings group "Account & app"
    Then the settings page shows the setting "Credits"

  Scenario: The credits list names the libraries the app is built with
    When I open the settings group "Account & app"
    And I open the credits
    Then the credits list shows "Vue" with the licence "MIT"
    And the credits list shows "Material Symbols" with the licence "Apache-2.0"

  Scenario: Every credit has an author and a link
    When I open the settings group "Account & app"
    And I open the credits
    Then every credit shows an author or a licence, and a link

  Scenario: The credits list opens without a connection
    Given the network connection is lost
    When I open the settings group "Account & app"
    And I open the credits
    Then the credits list shows "Vue" with the licence "MIT"
