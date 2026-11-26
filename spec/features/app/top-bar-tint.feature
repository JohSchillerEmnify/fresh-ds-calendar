@settings @id:top-bar-tint @area:app
Feature: The top bar stays one solid bar, also after Settings
  A try for a blurry top edge on iPad after Settings: the settings pages' bar is fixed to the top of the screen, the
  banners sit below it, and the calendar's top bar stays the same element while Settings is open. A WebKit engineer
  says the colour extension of the edge is needed when a fixed or sticky element sits near it (WebKit bug 301756); which change helps is
  still to be checked on an iPad.

  Background:
    Given the calendar is empty
    And today is 2026-11-04

  Scenario: The settings bar is fixed to the top of the screen and solid
    When I open the settings
    Then the settings bar is fixed to the top of the screen with a solid background

  @iphone
  Scenario: The settings bar stays in place when a long settings page scrolls
    When I open the settings
    And I scroll the settings to the end
    Then the settings bar is fixed to the top of the screen with a solid background

  Scenario: The calendar top bar is the same element after a visit to Settings
    Given I remember the calendar top bar
    When I open the settings
    Then no calendar top bar is shown
    When I leave the settings
    Then the calendar top bar is the one I remembered

  @tablet
  Scenario: On a tablet the settings bar is solid and fixed and the calendar top bar survives a visit
    Given I remember the calendar top bar
    When I open the settings
    Then the settings bar is fixed to the top of the screen with a solid background
    When I leave the settings
    Then the calendar top bar is the one I remembered

  @iphone
  Scenario: A banner sits below the settings bar, never under the status area, and can be tapped
    Given I open the path "/settings/views"
    And the network connection is lost
    When I choose "Week" as the default view
    Then I see the sync error banner
    And the sync error banner is below the settings bar and its retry button can be tapped
