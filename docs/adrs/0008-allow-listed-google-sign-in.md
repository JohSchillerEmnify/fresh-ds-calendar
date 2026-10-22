# 0008 — Allow-listed Google sign-in with per-person Google access

- Status: accepted (owner, 2026-10-14)
- Views shaped: `server`, `signIn`

## Context

The app moved from one household's LAN to a public VPS. Anyone could reach it, and each person must see their own
Google calendars, not one shared account.

## Decision

- One Google round trip both signs a person in and grants calendar (and Drive backup) access.
- Only addresses on an allow-list get a session; anyone else is turned away and their token discarded.
- Sessions are long-lived server-side records behind an HttpOnly cookie, extended on use.
- Each person's Google token is stored separately, and each request talks to Google with the token of the person
  signed in.
- Sign-in is on exactly when the real Google provider runs. With the mock (local runs, previews) it is off, so a
  preview stays one tap away; the server refuses to start open on a public HTTPS address unless told to on purpose.

## Alternatives

- *One shared Google account* (the start) — every person would see the same calendar.
- *A separate account system* — passwords to keep safe for a one-household app, when everyone already has Google.

## Consequences

- Adding a person is configuration (the allow-list), not code.
- Data the app keeps itself is per person.
