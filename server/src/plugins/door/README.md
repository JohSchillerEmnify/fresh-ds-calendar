# Door plugin

Read-only answer for the e-ink board inside the front door (its renderer runs on the home server). Spec:
`spec/features/door-board.feature`; decisions: ADR 0003 (the key), ADR 0004 (plugins).

**Off by default.** The plugin exists only when the deployment sets:

| Variable | Meaning |
|---|---|
| `DOOR_API_TOKEN` | The board's bearer key, at least 32 characters (`openssl rand -base64 32`); a shorter key is logged and leaves the door off. Never in a repo. |
| `DOOR_PERSON` | The Google address whose calendar the door sees. Ignored while sign-in is off (mock): then it is the local calendar. |

Without `DOOR_API_TOKEN` the endpoint is not there (404), `/api/health` and `/api/config` do not list `door`, and
the web app offers no "Show on door" switch.

## `GET /api/door`

`Authorization: Bearer <DOOR_API_TOKEN>` — missing or wrong: `401`, no data. 60 requests per minute per client.

```ts
{
  reminders: { title: string; list: string; date: string | null; time?: string }[];
  events:    { title: string; start: string; end: string; allDay: boolean }[];
}
```

- `reminders`: the open items of task lists tagged `door` that are due — dated today or earlier (from the day,
  whatever the time), or undated (due until done). A repeating list counts once, with its latest due occurrence.
  Oldest date first, undated last; items in their list's order.
- `events`: today's events of the person's visible calendars, timed and all-day, times in the server's zone as the
  calendar API gives them (an all-day event's `end` is the day after its last day, the calendar convention). Titles
  and times only.

"Show on door" is the tag `door` on the task list (`tags` in the task-list API); the web plugin
`web/src/plugins/door/` adds the switch to the list form and the list sheet.
