# 0035: Settings, categories, streak and plant are per person

Status: accepted (bug fix, owner: "everything has to be separate", 2026-11-01)

## Decision

`/api/settings` (theme mode, seed colour, default view, Calm mode, animations, sounds, device motion, sunflowers and the
categories) and `/api/motivation` (streak and plant) are stored per person in `users/<sub>/settings.json` and
`users/<sub>/motivation.json`, like prefs, canvas, templates and ink. The API shapes stay as they were, so the web app,
its device copy (ADR 0025, already one per person) and the outbox (ADR 0031) need no change. On the first start after the
update the old server-wide files are copied to every known person who has no own file yet and kept as `.bak`; a Drive
backup from before gives its `server/settings.json` and `server/motivation.json` to the person restoring it.

## Alternatives

- **Fold the settings into `/api/prefs` (`shared/prefs.js`):** one mechanism, but `Settings` is versioned with
  `If-Match` and the category endpoints answer the whole `Settings`; moving them would change the client, the device
  copy and the outbox at once in an urgent fix. Kept apart; they can still move into the prefs table later.
- **Keep one file keyed by person:** every write rewrites everybody's settings, and the backup would have to cut it.

## Consequences

A new person starts with the defaults (the four categories) instead of whatever somebody else chose. A shared list keeps
showing the owner's category to its members (the list document carries it). A settings change is announced to that
person only. Restoring a backup brings back the person's own settings and leaves everybody else's alone.
