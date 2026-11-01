# 0033: Ink strokes live in a server file per person, not in Google

Status: accepted (feature handwritten-lists, owner decision 2026-10-30)

## Decision

The strokes of a handwritten item are stored in `users/<sub>/ink.json` (one document per person, keyed by list id and
item id), with a copy on the device like every other per-person file (ADR 0025). In Google the item keeps only a flag
(`k: 1`) and the placeholder `Handwritten item` in the event description. Strokes are stored relative to the line height,
as `[x, y, pressure]` points, and a list holds about 1 MB of ink (strokes are stored smoothed to within half a pixel, so a word takes a few KB). The web app draws them with `perfect-freehand`.

## Alternatives

- **Strokes in the event's private properties:** Google allows about 30 KB there; one list of ink is far bigger.
- **A picture (PNG/SVG) per item:** small to render but not editable (no undo, erase, or adding to a line) and not
  scalable to every screen.
- **Strokes in the shared-list document or the Drive backup only:** the personal lists live in Google, so a
  per-person file beside canvas and templates (ADR 0018, 0024) is the established pattern and the backup takes it
  with the person's files.

Ink is keyed by item id, not by list: item ids are unique, so the occurrences of a repeating list that hold an item share
its ink without copying. A shared list keeps its ink inside its own document, so it follows the list to every member.

## Consequences

Ink is not in Google, so it is not searchable or visible in Google's apps (placeholder only). The file is read and
replaced whole; a per-item merge (G5) is done by the outbox writing one item's strokes at a time.

## Merging two devices (decision G5)

The outbox sends an ink change with the keys of the strokes it started from (`base`) and the time it was made (`at`);
a stroke carries the time it was drawn (`t`). The server applies the change on top of what it holds: strokes added are
kept, strokes taken away are gone, and a line cleared as a whole removes everything drawn before `at` and leaves an erase
mark (a stroke without points) so an older stroke that arrives later cannot bring the line back. Alternatives: whole-item
last-write-wins (an extension on one device would undo an erase on the other, or lose its strokes), and a CRDT per line
(more than one line of ink per item needs). Clocks of the devices are trusted to a few seconds.

### Clock skew

`t` and `at` must be whole, non-negative numbers. The server takes `at` as at most its own now (an erase never
happens in the future), and cuts a stroke's `t` back to at most 5 minutes ahead of its clock, so a wrong clock cannot make
a line unerasable or erase everything drawn later. A device whose clock runs behind erases only what was drawn before
its (earlier) time, and a device ahead has its strokes survive other devices' erases for up to that difference (at most 5
minutes). A stroke that comes back through undo gets a fresh `t`.
