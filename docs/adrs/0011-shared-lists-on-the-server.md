# 0011 — Shared task lists live on the server, not in a shared Google calendar

- Status: accepted (owner, 2026-10-14). Refines ADR 0005: shared lists leave Google.
- Views shaped: `server`, `shareList`

## Context

A couple wants to run some task lists together: one list ("the groceries") or a whole category ("Shopping"). Each has
their own Google account and their own categories.

## Decision

- A shared list is one document on the server with its owner, members and a version counter. Sharing **moves** the list
  out of the owner's tasks calendar (ADR 0006); "Stop sharing" moves it back as a new event.
- Sharing a category is a rule on top: it moves every list of the category, and new lists in it are created shared.
- Shared lists use the same API as own lists, merged into each member's reads; only the owner and members can see one.
- Both people edit everywhere; the list carries the owner's category for everyone. Only the owner deletes it for
  everyone; a member can leave it.
- Same optimistic concurrency as Google events: a stale edit is refused, item changes merge. The partner's changes
  appear on the next sync; no push channel.

## Alternatives

- *A calendar shared in Google* — needs an accepted invitation, exposes the whole tasks calendar or needs a second one
  per person, and has no per-list owner, "leave" or per-category rule.

## Consequences

- A shared list is not visible in Google Calendar; the Drive backup (ADR 0010) covers it.
