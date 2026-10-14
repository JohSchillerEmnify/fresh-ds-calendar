@release-notes @id:release-notes
Feature: Release notes in the app
  Every merge to main writes one or two plain sentences into CHANGELOG.md (owner, 2026-10-14). The app shows them under
  Settings → What's new, and after an update it says once what is new.

  Background:
    Given the calendar is empty
    And the release notes are:
      | date       | text                                                   |
      | 2026-10-14 | A grown task list now stays on its card when you zoom. |
      | 2026-10-14 | Titles of long events stay visible in Horizontal.      |
      | 2026-10-13 | The update prompt no longer comes back after reload.   |

  Scenario: Settings show the release notes, newest first, by day
    When I open the settings
    And I open What's new
    Then What's new shows the days "2026-10-14, 2026-10-13"
    And What's new shows "A grown task list now stays on its card when you zoom." under 2026-10-14

  @mobile
  Scenario: After an update the app says once what is new
    Given this device last ran an older version and has seen the notes up to 2026-10-13
    When I open the week view for 2026-10-12
    Then I am told what is new: "A grown task list now stays on its card when you zoom." and 1 more
    And the add button covers no control of the "release note"
    When I dismiss the release note
    And I reload the app
    Then I am not told what is new

  Scenario: The release note opens What's new
    Given this device last ran an older version and has seen the notes up to 2026-10-13
    When I open the week view for 2026-10-12
    And I choose What's new in the release note
    Then What's new shows the days "2026-10-14, 2026-10-13"

  Scenario: A device that never ran the app is not told anything
    When I open the week view for 2026-10-12
    Then I am not told what is new
