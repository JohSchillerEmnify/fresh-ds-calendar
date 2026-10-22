# 0009 — Diagnostics: a client beacon plus whitelisted server logs

- Status: accepted (owner, 2026-10-14)
- Views shaped: `server`

## Context

People saw "Can't reach Google Calendar" while the server logged nothing, so the cause (deploy restart, Google
errors, a VPS timeout, the phone's network on resume) could not be proven.

## Decision

- The server writes one-line JSON log entries for failed Google calls, server errors, cooldowns and sign-in steps,
  built only from a fixed list of fields. Never logged: tokens, addresses, the raw person id, titles, bodies,
  Google's message text, cookies; free text that does not match a strict pattern is dropped.
- The web app sends one beacon when it enters the error banner state (not while it lasts), because only the phone
  knows whether it was offline or had just resumed. A beacon lost to the network is sent once after the next
  successful sync. The server accepts one per session per minute.
- Logging only: no behaviour, response or retry changes.

## Alternatives

- *Infer the cause on the server* — cannot see the phone's network.
- *A persistent offline queue for beacons* — too much machinery for a diagnostic; the app has no offline writes
  (ADR 0005).
