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
- The templates are not in the last-known cache on the device (ADR 0023) for now: offline the template picker and the
  Templates page say "Templates need a connection" instead of an empty list. Kept out to keep the first version small;
  adding them later is a cache entry, not a design change.
- An unreadable `templates.json` is moved aside (`templates.json.corrupt-<ms>`) and the person starts empty, so a
  damaged file is never overwritten by the next save.
