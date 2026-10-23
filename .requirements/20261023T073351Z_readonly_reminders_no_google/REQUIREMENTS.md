# Read-only calendars: event reminders kept by the app, defaults always to Google

Owner (2026-10-23, supersedes the "retry 3 times" idea): Google's UI offers notifications for a whole read-only ("other")
calendar (stored per person) but never for single events. "The app should not ask google. how does it make sense to have
behaviour that we know fails."

## As Is
Per-event reminders of read-only events and defaults of read-only calendars went to Google first; a permission 403 made the
app keep them, with path/localSince/24 h TTL memory in `reminder-overrides.json`; the mock had a reader-reminders switch.

## To Be
1. Per-event reminders of an event in a calendar shared read-only are always kept by the app; `patchEvent` is never called.
2. Defaults of a read-only calendar always go to Google (`calendarList.patch`), like a writable calendar; no app copy.
3. Dead code removed: path, localSince, TTL, kept defaults, mock switch, test route, steps. Old files migrate: events stay,
   kept defaults and path memory are ignored (and gone at the next write).

## Requirements / acceptance criteria
- R1 event reminders kept, Google unchanged, `patchEvent` not called (unit + e2e "survive a reload").
- R2 defaults of a reader calendar land in Google, nothing kept (unit + e2e settings scenario).
- R3 old-format file: events kept, defaults ignored, file rewritten as `{ events }` (unit).
- R4 events in invitations in an own calendar (organizer other) still go to Google (existing unit test).
- R5 outage on defaults: 503, nothing stored; limits unchanged.

## Assumptions
- A1 "Read-only event" = event in a shared read-only calendar (`readOnlyReason.kind === 'calendar'`); an invitation in an
  own calendar is writable for reminders in Google and stays with Google (not what the owner's decision is about).
- A2 Stale kept defaults are simply ignored (Google is the truth), not migrated to Google.

## Testing plan
Unit `server/test/reminders-readonly.test.ts` (red first); e2e targeted @reminders on mobile.

## Implementation plan
Tests, store rewrite, CalendarService, mock/test route/steps removal, spec/STEPS/API/ADR 0015/server.c4. One PR-sized unit.
