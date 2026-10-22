# 0018 — A note's place lives on its list; Canvas areas live on the server

- Status: accepted (owner, 2026-10-13)
- Views shaped: `server`, `moveNote`

## Context

The Canvas places open task lists as notes on a board with named areas. Places and areas must be the same on every
device.

## Decision

- A note's place is two private integer properties on the list's event (0..10000); none = Unsorted. Every other write
  of the list keeps them.
- Areas are one per-person document on the server, read and replaced whole, backed up with the person's files.
- A note belongs to the topmost area under the middle of its top edge; membership is stored nowhere.

## Alternatives

- *Place as one JSON value* — two integers are tiny, readable in Google's raw event and stay queryable.
- *Areas as Google events* — rejected by the owner; rectangles are not events.
- *Areas in the prefs* — prefs are small merged switches; the areas are a growing document with its own limits.
- *One endpoint per area* — more routes and a half-saved board after a failed second call.
- *Stored membership* — would need keeping in sync when areas are deleted, resized or restored.

## Consequences

- The server limit is larger than the board, so the board can grow without a data migration.
- Two devices editing areas at the same moment: the last write wins.
- Deleting an area leaves its notes where they lie.
