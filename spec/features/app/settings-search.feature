@settings @settings-search @id:settings-search
Feature: Search the settings
  Owner, 2026-11-01: "needs ... a settings search".
  A search bar on top of the settings home finds settings while I type. It matches a setting's name, its
  supporting text and a short list of synonyms, all in the language the app is shown in; capitals and accents do
  not matter. Each result shows the setting's name and where it lives (group › subgroup). Choosing a result opens
  that group page, scrolls to the setting and highlights it for a moment. A setting that is hidden until another
  one is switched on leads to that switch. Calendars are found by their name. The search runs on the device, so it
  also works without a connection.

  Background:
    Given the calendar is empty
    And today is 2026-11-04

  Rule: Search matches names, descriptions and synonyms

    Scenario: A setting is found by its name
      When I open the settings
      And I search the settings for "side by side"
      Then the settings search shows "Events side by side: day" in "Views"
      And the settings search shows "Events side by side: week" in "Views"

    Scenario: Capitals do not matter
      When I open the settings
      And I search the settings for "LEFT-HANDED"
      Then the settings search shows "Left-handed mode" in "Appearance & layout"

    Scenario: A setting is found by a word of its description
      When I open the settings
      And I search the settings for "readable"
      Then the settings search shows "Minimum event length" in "Views"

    Scenario: A setting is found by a synonym
      When I open the settings
      And I search the settings for "dark mode"
      Then the settings search shows "Theme" in "Appearance & layout"

    Scenario: A calendar is found by its name
      Given the calendar contains an event "Standup" in the calendar "Work" on 2026-11-04 from 09:00 to 09:15
      When I open the settings
      And I search the settings for "work"
      Then the settings search shows "Work" in "Calendars"

    Scenario: Nothing matches
      When I open the settings
      And I search the settings for "xylophone"
      Then the settings search says nothing matches "xylophone"

    Scenario: Clearing the search shows the groups again
      When I open the settings
      And I search the settings for "sounds"
      And I clear the settings search
      Then the settings home is shown

  Rule: Search uses the language the app is shown in

    Scenario: A German app finds German words, not English ones
      Given the browser language is "de-DE"
      When I open the settings
      And I search the settings for "ruhe"
      Then the settings search shows "Ruhemodus"
      When I search the settings for "calm mode"
      Then the settings search says nothing matches "calm mode"

  Rule: A result takes me to the setting

    Scenario: Choosing a result opens its group and highlights the setting
      When I open the settings
      And I search the settings for "sounds"
      And I choose the search result "Sounds"
      Then the settings group page "Focus & calm" is shown
      And the setting "Sounds" is highlighted

    Scenario: A setting hidden behind a switch leads to that switch
      When I open the settings
      And I search the settings for "time of the overview"
      And I choose the search result "Time of the overview"
      Then the settings group page "Reminders" is shown
      And the setting "Morning overview" is highlighted

    Scenario: A Labs setting is found while Labs is off and leads to the Labs switch
      When I open the settings
      And I search the settings for "handwritten"
      Then the settings search shows "Handwritten lists" in "Labs"
      When I choose the search result "Handwritten lists"
      Then the settings group page "Labs" is shown
      And the setting "Show Labs features" is highlighted

  Rule: Search works offline

    Scenario: Search works without a connection
      Given the network connection is lost
      When I open the settings
      And I search the settings for "sounds"
      Then the settings search shows "Sounds" in "Focus & calm"
