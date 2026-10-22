@backup @id:drive-backup
Feature: Backup to Google Drive
  Everything the app keeps on its own server for me (my settings, theme, own themes and their pictures, task canvas)
  is backed up to the hidden app folder of my Google Drive, so a new or wiped server does not lose it. The app sees
  only that folder, never my other files. Backups run by themselves after changes (once I stop for a while), once a day
  even without changes, and when I press "Back up now". A backup that fails never gets in the way of normal use. On a
  server that has nothing of mine, my data comes back by itself at sign-in; otherwise I can restore it from Settings.
  The last 7 backups are kept; someone with nothing of their own on the server gets none, and a restore never
  overwrites what other people use.

  Background:
    Given the time is 2026-10-12 08:00
    And "jo@example.com" and "anna@example.com" may use the calendar

  Scenario: A change is backed up after the quiet period
    Given "jo@example.com" is signed in
    When the support cat is set to "Every time" in the settings
    And the quiet period of the backup has passed
    Then the Drive holds 1 backup of "jo@example.com"
    And the last backup is from 2026-10-12 at 08:00

  Scenario: A daily backup happens without changes
    Given "jo@example.com" is signed in
    And the support cat is set to "Every time" in the settings
    And I back up now
    When a day passes on the server
    Then the Drive holds 2 backups of "jo@example.com"

  Scenario: "Back up now" shows the new time
    Given "jo@example.com" is signed in
    And the support cat is set to "Every time" in the settings
    And I back up now
    And the last backup is from 2026-10-12 at 08:00
    When the time is 2026-10-12 09:30
    And I back up now
    Then the last backup is from 2026-10-12 at 09:30

  Scenario: A fresh server restores my theme and canvas at sign-in
    Given "jo@example.com" is signed in
    And I chose the theme "Neon"
    And I open the Canvas
    And I create the area "Garden" on the Canvas
    And I back up now
    When the server loses all data of "jo@example.com"
    And "jo@example.com" signs in with Google
    Then the theme "Neon" is in use
    When I open the Canvas
    Then the Canvas shows the area "Garden"

  Scenario: A manual restore brings back an older state after confirming
    Given "jo@example.com" is signed in
    And I chose the theme "Neon"
    And I back up now
    And I chose the theme "Winter"
    When I restore from the backup
    Then the restore asks for confirmation
    When I confirm the restore
    Then the theme "Neon" is in use
    And the Drive holds 2 backups of "jo@example.com"

  Scenario: A failed backup shows the status and does not block saving
    Given "jo@example.com" is signed in
    And the support cat is set to "Off" in the settings
    And the Drive is unavailable
    When I back up now
    Then the backup status says it failed
    When the support cat is set to "Every time" in the settings
    Then the saved support cat setting is "Every time"

  Scenario: Without the Drive permission the app asks for it and does not back up
    Given "anna@example.com" signs in without the Drive permission
    When I open the settings
    Then I am asked to allow backups to Google Drive
    And there is no button to back up now
    And the Drive holds 0 backups of "anna@example.com"

  @backlog
  Scenario: Only the last 7 backups are kept
    Given "jo@example.com" is signed in
    And I chose the theme "Neon"
    When I back up now 8 times
    Then the Drive holds 7 backups of "jo@example.com"

  @backlog
  Scenario: Someone with nothing of their own on the server is not backed up
    Given "anna@example.com" is signed in
    When a day passes on the server
    Then the Drive holds 0 backups of "anna@example.com"

  @backlog
  Scenario: Restoring a second time undoes the restore
    Given "jo@example.com" is signed in
    And I chose the theme "Neon" and backed it up
    And I chose the theme "Winter"
    When I restore from the backup and confirm, twice
    Then the theme "Winter" is in use

  @backlog
  Scenario: My restore does not overwrite what another person uses
    Given "jo@example.com" is signed in with the theme "Neon" backed up
    And "anna@example.com" adds the category "Garden"
    When I restore from the backup and confirm
    Then the theme "Neon" is in use
    And the category "Garden" still exists
