# 0033: Ink strokes live in a server file per person, not in Google

Status: accepted (feature handwritten-lists, owner decision 2026-10-30)

## Decision

The strokes of a handwritten item are stored in `users/<sub>/ink.json` (one document per person, keyed by list id and
item id), with a copy on the device like every other per-person file (ADR 0025). In Google the item keeps only a flag
(`k: 1`) and the placeholder `Handwritten item` in the event description. Strokes are stored relative to the line height,
as `[x, y, pressure]` points, and a list holds about 200 KB of ink. The web app draws them with `perfect-freehand`.

## Alternatives

- **Strokes in the event's private properties:** Google allows about 30 KB there; one list of ink is far bigger.
- **A picture (PNG/SVG) per item:** small to render but not editable (no undo, erase, or adding to a line) and not
  scalable to every screen.
- **Strokes in the shared-list document or the Drive backup only:** the personal lists live in Google, so a
  per-person file beside canvas and templates (ADR 0018, 0024) is the established pattern and the backup takes it
  with the person's files.

## Consequences

Ink is not in Google, so it is not searchable or visible in Google's apps (placeholder only). The file is read and
replaced whole; a per-item merge (G5) is done by the outbox writing one item's strokes at a time.
