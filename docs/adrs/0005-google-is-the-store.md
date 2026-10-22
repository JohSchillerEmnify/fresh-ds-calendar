# 0005 — Google Calendar is the store for events and task lists; no database

- Status: accepted (owner brief, 2026-10-12)
- Views shaped: `index`, `server`, `loadRange`, `prod`

## Context

The owner wants a Google Calendar clone whose data stays in Google: everything syncs with Google Calendar, and a
task list must stay readable in the official Google app. Real Google sign-in needed owner action (a Google Cloud
project, an HTTPS domain) that was not there at the start.

## Decision

- Events and task lists live only in each person's Google Calendar. The server passes every read and write through
  to Google and keeps no copy beyond a short read cache (ADR 0007).
- The app's own data (preferences, settings, streak and plant, canvas places, shared lists, themes) lives as JSON
  files per person on the server's data volume. No database.
- The server reaches Google only through one provider interface with two implementations: the real Google provider
  and a mock that keeps a Google-shaped calendar on disk. The mock runs locally and in every e2e run.

## Alternatives

- *Own database, Google as a sync target* — offline writes and faster reads, but two sources of truth and a
  conflict-resolution problem for a one-household app.
- *Real Google only* — no way to build or test before the owner set Google up, and e2e runs would hit real
  accounts.

## Consequences

- No offline writes: a change made while Google is unreachable fails visibly.
- A remote change shows after the next re-fetch, not instantly.
- Backups cover only the app's own files; Google holds the rest.
