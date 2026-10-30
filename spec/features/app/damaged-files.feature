@data @id:damaged-files
Feature: A damaged data file is kept, not lost
  The server keeps each person's canvas, task list templates, own themes, preferences and reminders for read-only events
  in files of their own. When one of those files is damaged (cut off, edited by hand), the person starts with the
  defaults for that part, but the damaged file is never overwritten by the next save: it is renamed to
  "<name>.corrupt-<timestamp>.json" next to the original and one line is logged, so the owner can repair it.

  # This describes the server's files, which the browser suite cannot reach, so the scenario is tagged @unit and names
  # the unit tests that cover it.

  # unit: server/test/personJsonStore.test.ts:canvas: keeps the file and does not overwrite it on the next put
  # unit: server/test/personJsonStore.test.ts:prefs: keeps the file, returns defaults and does not lose it on the next write
  # unit: server/test/personJsonStore.test.ts:templates: keeps the file aside as templates.corrupt-<timestamp>.json
  # unit: server/test/personJsonStore.test.ts:themes: sets a damaged theme file aside, keeps the good ones and does not list the copy
  # unit: server/test/personJsonStore.test.ts:reminder overrides: keeps the file and starts empty
  @unit
  Scenario: A damaged preferences file is set aside and not overwritten
    Given the stored preferences of "jo@example.com" are damaged
    When "jo@example.com" changes a preference
    Then "jo@example.com" has the default preferences plus the change
    And the damaged file is kept as "prefs.corrupt-<timestamp>.json" with its old content
