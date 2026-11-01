# 0031 — Offline changes: outbox, last arrival wins, sync-failed icon

- Status: accepted (owner, 2026-10-30, review of the slice 2 spec); refines 0025
- Views shaped: `web`, `outbox`, `outboxSender`, `sendingOfflineChanges`

## Decision
- **Outbox.** Events, task lists and their items are changed on the device at once and appended to a per-person outbox
  in IndexedDB; one sender sends it in order, one entry at a time, on open, focus, `online`, the poll and right after a
  change. Each entry carries the changed fields, its etag and an `Idempotency-Key` (API.md), so a resend is harmless. The server keeps each key's answer for 24 hours in the person's own JSON file, so it survives a restart (an in-memory table would let a resend after a restart apply twice).
  Settings, themes, templates, the Canvas and sharing follow in slice 3.
- **Last arrival wins.** On `412` the entry is resent on the newest etag: the change that reaches the server last wins,
  only the fields it touches change, a delete wins over an edit. The overwritten side is not told.
- **Refusals.** A `400`/`404` entry is dropped, the device copy returns to the server's state, and a persistent notice
  names the change with "Edit again" (reopens the form with what was typed; not for a tick). Later independent entries go on.
- **No marks, no counter.** Changes are not marked as unsent. After 5 minutes without a successful send or sync a "sync
  failed" icon appears beside the sync status; its sheet shows the last successful sync and the unsent changes; the
  next success removes it. The sync error banner is not shown for a failed send.
- **People.** The outbox is bound to its person and never sent under another. An expired session keeps it for the same
  person; signing out asks first when it holds changes. No dialog for another person signing in over it.
- **Ink is held per line (handwritten lists, W2).** The rewrites of one ink line are kept on the device at once but not
  sent while the line is being written: a newer rewrite folds into the unsent one (keeping its first `base`), and the
  line goes once on the done button, when the list closes or the page goes away, or 10 s after its last stroke. Other
  entries pass a held line; the hold lives in memory only, so after a restart everything is sent.

## Alternatives
- *Order by the time of making* — needs trustworthy device clocks; arrival order is Google's own behaviour.
- *Whole-item overwrite* — loses the other side's unrelated fields; Google's PATCH already merges.
- *Stop the outbox on a refusal and ask* — one bad entry would hold every later change on a phone.
- *A mark per item or a counter* — constant noise for a normal state; the owner wants offline writing to look normal.
- *Merge entries per item* — fewer requests but more rules; sending as made is simple and exact. Ink lines are the
  one exception: one request per stroke was too many (owner, 2026-11-01).
- *A sync library* — see 0025: the server of record is Google behind our API.
