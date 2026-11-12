@i18n @id:language
Feature: Language
  The app speaks English, German (Deutsch) and two fun variants of German: light Mainfränkisch ("Fränggisch") and
  Coldmirror slang. By default the language follows the device: a German browser shows German, everything else
  English. A person can choose a language in Settings → Appearance → Language; the choice is kept per person, holds on
  every device and takes effect at once, without a reload. The fun languages may leave texts untranslated: those show
  in German. Dates, month names and weekday names follow the language (de-DE for German and the fun variants); the clock
  stays 24 h and weeks start on Monday.

  Background:
    Given the calendar is empty
    And today is 2026-10-13

  Scenario: A German browser shows German navigation and settings
    Given the browser language is "de-DE"
    When I open the week view for 2026-10-13
    Then the view switcher shows "Jahr, Monat, Woche, Tag, Aufgaben, Uhr"
    And the page language is "de"
    When I open the settings
    Then the settings groups are "Kalender, Ansichten, Aufgabenlisten, Erinnerungen, Aussehen & Aufbau, Fokus & Ruhe, Widgets, Labor, Konto & App"
    And the language "Automatisch" is selected

  Scenario: Choosing English in the settings switches at once
    Given the browser language is "de-DE"
    When I open the settings
    And I choose "English" as the language
    Then the settings groups are "Calendars, Views, Task lists, Reminders, Appearance & layout, Focus & calm, Widgets, Labs, Account & app"
    And the page language is "en"
    And the page was not reloaded
    When I leave the settings
    Then the view switcher shows "Year, Month, Week, Day, Tasks, Clock"

  Scenario: The language choice follows the person to another device
    When I open the settings
    And I choose "Deutsch" as the language
    And I switch to another device
    And I open the week view for 2026-10-13
    Then the view switcher shows "Jahr, Monat, Woche, Tag, Aufgaben, Uhr"

  Scenario: Fränggisch shows dialect labels and falls back to German where untranslated
    When I open the settings
    And I choose "Fränggisch" as the language
    Then the settings groups are "Kalender, Ansichdn, Aufgabnlisdn, Erinnerunga, Aussehn & Aufbau, Fokus & Ruh, Widgets, Labor, Kondo & App"
    And the page language is "de-x-mainfr"
    When I leave the settings
    Then the view switcher shows "Jahr, Monad, Woche, Dag, Aufgabn, Uhr"

  Scenario: German shows dates in German
    Given the browser language is "de-DE"
    When I open the month view for 2026-10
    Then the period title is "Oktober 2026"
    And the weekday headers are "Mo, Di, Mi, Do, Fr, Sa, So"

  @desktop
  Scenario: German shows the day title in full on a desktop
    Given the browser language is "de-DE"
    When I open the day view for 2026-10-13
    Then the period title is "Dienstag, 13. Oktober 2026"

  @mobile
  Scenario: German shows the day title short on a phone
    Given the browser language is "de-DE"
    When I open the day view for 2026-10-13
    Then the period title is "Di., 13. Okt."
