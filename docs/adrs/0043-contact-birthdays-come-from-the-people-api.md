# 0043: Contact birthdays come from the People API, behind an opt-in permission

Status: proposed (issue 93; the owner has asked for contact birthdays to be visible, the choices below are the spec's)

## Decision

The app reads the birthdays of the person's Google contacts through the People API (`people.connections.list`,
`personFields=names,birthdays,events`, sync token) and adds them to the virtual Birthdays calendar (ADR 0038) as read-only
events. This is a second Google source next to the Calendar API. It needs the scope `contacts.readonly`, which the plain
sign-in does not ask for: the Birthdays settings page offers it (`/api/auth/google/start?contacts=1`, incremental grant with
`include_granted_scopes`). Without it nothing changes. The contact birthday is dropped when a calendar birthday event is
the same person (same `birthdayProperties.contact` resource name, else the same title on the same day). Only the contact's
birthday date counts, not anniversaries or custom dates. The app never writes to Contacts; the Birthdays calendar stays app-only.

## Alternatives

- **Rely on the birthday events of the Calendar API (before):** since 2025 Google no longer offers the contacts calendar,
  and the primary calendar holds only some contact birthdays, so others never reach the app.
- **Ask for `contacts.readonly` at every sign-in:** one consent screen, but every person (also people who never want it) is
  asked for contacts, and existing sessions would need a forced re-consent. The opt-in button costs one tap.
- **The wider `contacts` scope:** includes write access the app never uses.
- **`otherContacts.list` (`contacts.other.readonly`):** holds auto-saved addresses with only names and e-mail addresses, never
  birthdays.
- **Read the contacts on the device:** the web app has no Contacts API and the Android app would need a native plugin and
  its own permission; the server already holds the person's Google token and the device-first sync (ADR 0025).

## Why this won

It is the only source with every contact's birthday, uses the existing per-person token, the virtual calendar's switch and
colour, and the change feed (so it is on the device and offline), and asks for a read-only scope only from people who choose
it. Cost: Google's consent for a sensitive scope (app verification), a second Google client to mock, a per-person sync token
(expires after 7 days, then a full read), and a dedupe rule across two sources.
