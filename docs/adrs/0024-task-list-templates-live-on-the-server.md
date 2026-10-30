# 0024 — Task list templates live on the app server

- Status: accepted (owner, 2026-10-25)
- Views shaped: `server`

## Context

A task list can be saved as a template and a new list can start from one (feature tasklist-templates). Templates
must follow the person to every device and must never show up as events.

## Decision

- Each person's templates are one JSON document in `DATA_DIR/users/<sub>/templates.json`, served by `/api/templates`
  (list, add, replace whole, delete), backed up to the person's Drive with their other files (ADR 0010).
- A template keeps a name (unique per person, ignoring case and accents), its item titles in order, the estimate and
  the category. Never a date, time, repeat, reminders, tags, sharing or ticks.
- Lists made from a template keep no link to it: changing or deleting a template never changes them.

## Alternatives

- *A private event per template in the hidden tasks calendar* — every read of lists would have to filter it out, and it
  would show in Google once the tasks calendar is made visible; a template is not a date.
- *On the device only (IndexedDB)* — would not follow the person.
- *Inside the prefs* — prefs are small merged switches; templates are a growing document with their own limits.

## Consequences

- Two devices changing the same template at the same moment: the last write wins.
- At most 100 templates of at most 200 items each per person.
- The server is the store; the device keeps a copy with the rest of the last known state (ADR 0023, field `templates`
  of the snapshot): restored at start, read again on every sync (a sync task) and when the picker or the Templates page
  opens, wiped on sign-out with the rest. Offline the templates can be used but not changed (no queue, as every other
  change). Revised 2026-10-25 (owner: "Everything should be stored on device and only synced from the server"); the
  first version kept them out and said "Templates need a connection" offline, which the owner rejected.
- An unreadable `templates.json` is moved aside (`templates.json.corrupt-<ms>`) and the person starts empty, so a
  damaged file is never overwritten by the next save.
- Malformed entries of a readable file are dropped on read and not kept: the next save writes the file without them.
