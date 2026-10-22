# 0019 — Finished task lists carry a "done" marker

- Status: accepted (owner, 2026-10-13: "pick an efficient way")
- Views shaped: `finishList`

## Context

The Archive shows every finished list, of any age, dated or undated (undated ones sit on 2099-12-31, ADR 0017). There
is no stored "archived" flag: a list is archived when every item is ticked.

## Decision

Every write that leaves a list finished sets the private marker `done=1`, derived from the items, so it never
disagrees with them. The Archive reads the marker with Google's private-property filter (no time range), plus the
±365-day range as a lazy backfill for lists finished before the marker existed.

## Alternatives

- *A bounded date range only* — cheap and needs no data change, but old lists vanish and archive-only undated lists
  lie outside any range.

## Consequences

- Google filters server side, so the answer holds only finished lists.
- Older unmarked lists are not found until they are edited once (pre-release; no migration job).
