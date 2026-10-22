# 0017 — Undated task lists are events on a fixed anchor date

- Status: accepted (owner, 2026-10-13). Builds on ADR 0006.
- Views shaped: `finishList`

## Context

A task list may have no date. Every other list is an event in the person's tasks calendar (ADR 0006).

## Decision

An undated list is an all-day event on **2099-12-31** with the private marker `undated=1`, in the same tasks calendar.
It is read with Google's private-property filter (no time range); every date-range read drops it. Giving it a date
moves the event and removes the marker; "No date" moves it back. It cannot repeat and has no time.

## Alternatives

- *A separate store* (a server file or a second calendar) — dating would move data between stores.
- *A flag on an ordinary date* — the list would still sit on some real day.

## Consequences

- The same sync, backup, etag and conflict handling cover undated lists; dating is just moving the event.
- People who show the tasks calendar in Google see these events in the year 2099.
