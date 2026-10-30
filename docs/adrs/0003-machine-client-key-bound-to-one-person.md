# 0003 — A machine client reads with its own key, bound to one person

- Status: Moved to the door repository 2026-10-30 (accepted, owner, 2026-10-19). The door plugin and this ADR live in `JohSchillerEmnify/fresh-ds-calendar-door`; the calendar keeps only the plugin seam (ADR 0004).
- Views shaped: `doorRead`, `server`

## Context

The door board (a renderer on the home server) needs a read-only slice of one person's calendar: the open items
of door-tagged task lists and today's events. Every other reader of the API is a person with a browser session
(Google sign-in). The board has no browser and no person at the keyboard; the calendar knows several people.

## Decision

A machine client authenticates with a **bearer key of its own**, not a person's session: at least 32 random
bytes, compared in constant time, missing or wrong → refused as unauthenticated with no data. The key is
**bound to one person** by configuration next to it (`DOOR_API_TOKEN` and `DOOR_PERSON` in the server's
environment on the VPS; on the home server a mode-600 file the renderer mounts). Neither value lives in a repo.
The endpoint answers titles and times only, nothing a person did not already see on the door.

## Alternatives

- *Reuse a person's session cookie on the board* — a browser secret copied to a device; expires, re-auth
  needs a person, and grants the whole API.
- *Bind the key to the first allowed email* — no new variable, but implicit: silently points the door at
  someone else when the order changes.
- *A switch in Settings ("this is the door's calendar")* — more UI for a one-time wiring the owner does once.

The door is a **deployment flag** (owner, 2026-10-19: the repo is going public, nothing of this is on by
default): with no `DOOR_API_TOKEN` the server has no door endpoint and tells the web so, and the web offers no
"Show on door" switch. Setting the two variables is the whole opt-in. Where that code lives is ADR 0004 (a plugin
folder, loaded by the registry only when configured).

## Consequences

- Rotating the key is editing two environment files and restarting; no person is involved.
- A second machine client (another board, a widget) gets its own key and person the same way.
- The endpoint is the only place a key is accepted; the session middleware stays as it is.
