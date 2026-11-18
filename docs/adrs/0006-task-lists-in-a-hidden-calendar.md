# 0006 — Task lists are events in a hidden per-person "tasks" calendar

- Status: accepted (owner, 2026-10-13)
- Views shaped: `server`, `firstTaskList`

## Context

Task lists are stored as Google events (ADR 0005), encoded so the official app still shows them (contract: API.md
"Storage in Google"). In the main calendar they clutter every other Google client the person uses.

## Decision

Each person's task lists live in their own secondary calendar "Calendar app: tasks", created by the app once the person
confirms task lists (feature tasklists-calendar-consent; one creation per person, even under parallel requests) and hidden in Google's calendar list via the
API (Google Calendar may still show it; the app cannot control that). The app never offers it as an event calendar.

## Alternatives

- *Main calendar* (the start) — no setup, but clutters Google.
- *Server storage with Drive backup* (option B) — free of Google's event limits, but the lists leave Google;
  may follow on the VPS and would replace this.

## Consequences

- No migration was needed: there were no real Google accounts yet.
- Events in the tasks calendar that are not task lists are ignored.
