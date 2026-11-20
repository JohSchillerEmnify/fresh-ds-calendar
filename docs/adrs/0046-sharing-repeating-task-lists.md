# 0046 — Sharing repeating task lists: where the repeat rule lives

- Status: proposed
- Views shaped: `server`, `web`
- Extends: [0033](0033-ink-strokes-in-a-server-file-per-person.md), [0025](0025-device-first-storage-synced-with-the-server.md)

## Context

**Sharing today.** `TaskSharing.shareTaskList` MOVES a list from the owner's tasks calendar into the shared store: a
document per list (`SharedListDoc`, `server/src/services/sharedLists.ts:17`) with `owner`, `members`, one `rev` (the
etag), the list `data` and its `ink`; the Google event is deleted once the shared copy is written
(`server/src/services/taskSharing.ts:43-53`). "Stop sharing" writes the event back (`:62-72`), "Leave" removes one
member (`:75-79`).

**Why repeating lists are refused.** The Google rule lives on the event, not in the list data. `moveIn` throws
`sharing.repeating` for a list with a rule or an occurrence (`taskSharing.ts:46`) and sharing a category skips them
(`:104`). A shared document has no occurrences, so the rule would be lost.

**Repeating lists today.** The rule is a Google `RRULE` on the master event (daily, weekly or monthly only,
`taskCodec.ts:15,244-246`). Occurrences are Google instances; the first tick or edit of one turns it into an exception
event of its own, so each occurrence keeps its own ticks. An edit for "This and all following task lists" is not a Google
operation: `TaskSeries.forFollowing` (`taskSeries.ts:92-115`) changes later parts as a whole, ends the old series with
`UNTIL` and starts a new series (parts linked by the private `series` key). A rule with `COUNT` is refused (`:99`). It
already refuses shared ids (`:93`). Ink is keyed by item id, so occurrences holding an item share its ink (ADR 0033);
a shared list keeps its ink inside its document. A dated shared list appears once in a range read
(`itemQueries.ts:69-73`), and the widget reads through the same items service (ADR 0044).

## Decision drivers

Owner request (issue #178): repeating lists shareable, all occurrences shared, more than one person. Device-first (ADR
0023/0025): a member's device copy must hold every occurrence it shows and work offline. Data per person: ticks belong
to the occurrence, not to a person. One rule, one place: expansion lives in `shared/` or the server, not twice.

## Options

**A. The rule stays in the shared document; the server expands occurrences.** The document keeps `data.recurrence` and
`data.date` (start), plus `occurrences: { <date>: override }` (ticks, items, title of an occurrence that was touched) and
an optional `until`. Range reads expand the rule themselves (the three rhythms are simple; check a maintained library
such as `rrule` before writing the month-end handling) and merge overrides. "This and all following": split like
`forFollowing`, as a second document of the same `series` key that takes the later part. Members and ink are per
document, so a split must copy them. Device-first: the server sends the occurrences of the requested range, so the
device copy gets them as ordinary items; offline reads work as for any list. Costs: own recurrence expansion on the
server; one more code path next to Google's.

**B. The series stays in the owner's Google calendar; the shared store holds a reference.** Members would read the
owner's events through the owner's token. Fails device-first and per-person data: a member's view depends on the owner's
Google session and calendar, ticks by a member must be written into the owner's Google, an owner who revokes access or
disconnects takes the list away, Drive backups and "Stop sharing" cannot be self-contained, and the shared store is no
longer the only truth for members. Rejected.

**C. Materialise each touched occurrence as its own shared document; the untouched ones come from a master document.**
Hybrid of A: ticks and edits of an occurrence become ordinary shared documents (own `rev`, ink, members, existing
write paths, no change to ink or conflict handling) tied to the series by a `series` key and a rule date, while a
master document holds the rule. "This and following" applies to every later document and splits the master as
today. Reuses the most existing code, but many small files per series, and members must be kept equal across all
documents of the series on every share, leave and stop-sharing.

## Consequences by topic (A and C)

- **Members' views:** every member sees the same occurrences; a tick is per occurrence, not per person.
- **Ticks per occurrence:** an override per date (A) or a document per touched date (C); the etag of an edit is the
  document's `rev`, so two people ticking different occurrences of one document conflict under A unless the override
  is patched per date. This needs a decision.
- **"This and following" by a member:** allowed for any member as for the owner, with the same split; both go through one
  server operation, not the web client.
- **Stop sharing:** the owner gets the master back as a Google series with `RRULE`, and every touched occurrence as an
  exception event (as `moveOut` writes the list back, `taskSharing.ts:62-72`); a failure must not lose the series, so
  Google is written first.
- **Leave / remove a member:** only that member loses the series; the owner and the others keep it.
- **Widget and items service:** one rule in the items read, so the widget agrees with the app.
- **Drive backups:** the document(s) are copied as they are (`sharedListsBackup.ts`), so a restore brings back the rule
  and the overrides; a restore needs no Google.
- **Category sharing:** repeating lists of a shared category would be moved too (the skip at `taskSharing.ts:104` goes).
- **Rules with `COUNT`:** stay unsupported for "this and following"; sharing may refuse them (open question).

## Recommendation (only a recommendation)

Option A: one document per series with the rule and per-date overrides, "this and following" as a split into a second
document of the same series. It keeps the shared store as the only truth for members (the device-first rule), needs no
Google access for members, and keeps data in one file per series for backups. C is the fall-back if per-date patching
inside one document proves too hard for conflicts.

## Open questions

Which rhythms and `COUNT` rules may be shared, who may change "this and following", and what a past occurrence keeps after leaving are decided by the owner before the build.
