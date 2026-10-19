# Request from the door board: "Show on door" + `GET /api/door`

From the door-board project (`~/projects/door-board`, 2026-10-19). Nothing in this repo has been changed by
that work; this file only describes what the door board needs. Build it when it suits the calendar's own plans.

The door board is a small e-ink screen on the inside of the front door that shows **Reminders** before leaving.
Its server, `door-renderer` (on sauron, page at http://door.mordor.lan), already shows the HA Door list, weather
and Occupied rooms. It still needs two things from the calendar, read from the real instance
`https://cal.example.org`:

1. **Reminders**: open items of task lists marked for the door.
2. **The next event**: today's events, so the board can show the next one that hasn't started yet.

Full spec (sources, layout, decisions 26–27): the Claude Doc "Door E-Ink Board — Spec",
https://claude.ai/code/artifact/1b67a5e4-c076-4970-8542-7e960dedabc6

## 1. "Show on door" toggle

- One switch in the task list form: **Show on door**.
- Stored as the tag `door` in `extendedProperties.private.tags`. Tags otherwise stay shelved (owner, 2026-10-13);
  stored tags already round-trip, so nothing else changes.

## 2. `GET /api/door`

Read-only, for one machine client (door-renderer).

- **Auth:** `Authorization: Bearer <token>`. The token is at least 32 random bytes, compared in constant time.
  Missing or wrong token → `401` with no data. Rate-limited.
- **Token storage:** an env var on the VPS (for example `DOOR_API_TOKEN`) and, on sauron, a mode-600 file that
  door-renderer mounts read-only. It never goes into either repo.
- **Response:**

  ```ts
  {
    reminders: { title: string; list: string; date: LocalDate; time?: LocalTime }[];
    events:    { title: string; start: string; end: string; allDay: boolean }[];
  }
  ```

  - `reminders`: the open (unticked) items of task lists with the `door` tag, dated **today or earlier**.
    `title` is the item, `list` the list's title, `date`/`time` the list's date and (optional) time.
    Oldest date first; within a list, the list's item order.
  - **Repeating lists:** only the **latest due occurrence** counts (today's, else the most recent past one).
    Older unticked occurrences drop off once a newer one is due, so forgotten ones don't pile up on the door.
  - `events`: **today's** events from all calendars, timed and all-day, in Europe/Berlin local time.
  - Only titles and times: no descriptions, attendees or locations.

## Acceptance criteria (from the door-board spec)

```gherkin
Feature: Calendar Reminders for the door board

  Scenario: Door-tagged task list shows from its date
    Given a task list "Friday errands" dated next Friday with "Show on door" on
    Then its open items are not in /api/door before Friday
    And from Friday they are, until every item is ticked

  Scenario: Untagged task list stays off
    Given a task list dated today without "Show on door"
    Then none of its items are in /api/door

  Scenario: Repeating list shows only its latest due occurrence
    Given a weekly door-tagged list "Bin day" whose last two occurrences are both unticked
    Then /api/door lists only the items of the most recent occurrence

  Scenario: Wrong token
    When /api/door is called without a valid bearer token
    Then the response is 401 and contains no data
```

## Open questions for the calendar side

- **Undated door lists:** should an undated list with "Show on door" count as always due? The spec only covers
  dated lists.
- **Where the toggle lives:** the task list form only, or also somewhere quicker, like the expanded card?
