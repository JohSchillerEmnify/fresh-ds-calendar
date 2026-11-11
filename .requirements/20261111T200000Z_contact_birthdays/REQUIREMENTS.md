# Contact birthdays (issue 93)

## As Is
Birthdays reach the app only as `eventType: 'birthday'` events of the person's Google calendars (ADR 0038). Google's contacts
calendar is gone for both users (the production `calendar_shape` log lists no `addressbook#contacts` calendar), and the primary
calendar holds only some contact birthdays, so others never show. Owner: "the contact bds should also be visible."

## To Be
With the read-only permission `contacts.readonly`, the birthdays of the person's Google contacts show in the virtual Birthdays
calendar (app only, per-person colour and switch), read-only, once each, on the device offline. Without the permission nothing
changes and the Birthdays settings page offers to allow it. Spec: `spec/features/events/contact-birthdays.feature`; API in
`spec/API.md` ("Birthdays from Google Contacts"); decision in ADR 0043.

## Requirements
1. A contact's birthday shows in the Birthdays calendar in its colour, every year; the Birthdays switch hides it.
2. It shows once when a calendar birthday event is the same contact (resource name) or has the same title and day.
3. Year known: the details show "Turns N"; no year: no age.
4. Read-only, with the hint "Change this birthday in Google Contacts". No write to Google.
5. Only the contact's birthday date; no anniversaries or custom dates.
6. Device-first: part of the change feed, readable offline (ADR 0023/0025).
7. Per person: own token, own sync token, own events.
8. Permission: not asked at sign-in; a button on the Birthdays settings page grants it incrementally; an absent permission or a
   failing People API never breaks the other birthdays or the calendar.

## Acceptance Criteria
The scenarios of `contact-birthdays.feature` (one or more per requirement, all `@backlog` until built).

## Testing Plan
- Unit (server): People API mapping (year 0, 29 February, missing names, `metadata.deleted`), dedupe, sync-token flow incl.
  `EXPIRED_SYNC_TOKEN` and error answers, missing scope (403) leaves other birthdays untouched, per-person isolation.
- Unit (web): device store keeps the events and `contactsPermission`; the age text; the settings offer.
- e2e: the scenarios, against a mock People API that follows the documented semantics (sync-token changes only, deleted flag,
  `contacts.readonly` needed, page size 1000).
- `@visual`: Birthdays settings page with the offer; the read-only dialog with the hint (phone size).

## Implementation Plan
1. Mock People API + test endpoints; scope in the fake OAuth. Test: contacts of a person.
2. Server service: read, map, sync token, store per person; unit tests.
3. Merge into the virtual calendar, dedupe, change feed, `contactsPermission` on the calendar. (PR-sized with 1 and 2.)
4. Web: read-only dialog hint and age, settings offer and `?contacts=1` flow, i18n (all locales).
5. Steps, e2e, baselines; LikeC4 model (server reads the People API).

## People API facts checked (Google discovery document, 2026-11-11)
`people.connections.list`: scopes `contacts` or `contacts.readonly`; `personFields` incl. `names,birthdays,events`;
`pageSize` 1-1000 (default 100); `requestSyncToken`/`syncToken`: changes only, deleted contacts have `metadata.deleted`,
tokens expire after 7 days (`EXPIRED_SYNC_TOKEN`, then a full sync), all other parameters must equal the first call, writes
propagate with a delay of minutes; the first page of a full sync has an extra, fixed quota (429). `Birthday.date` is a `Date`
whose year 0 means "no year"; `text` is deprecated. `Event.type` is a custom string or `anniversary` / `other`.
`otherContacts` (`contacts.other.readonly`) carries no birthdays. Existing OAuth: scopes in
`server/src/providers/google/auth.ts` `SCOPES`, `include_granted_scopes: true`, the granted scope is stored with the token
(`auth/people.ts`); a new scope needs a new consent, which `start?contacts=1` triggers only on request.

## Assumptions and open questions
1. Opt-in button, not asked at sign-in (ADR 0043).
2. Only the birthday date counts; anniversaries and custom dates do not show.
3. Age is shown only in the details ("Turns N"), not on the chip; calendar birthdays show none today.
4. Dedupe by resource name, else same title (case-insensitive) and day; the calendar event wins.
5. Contacts with no display name are skipped.
6. `contacts.readonly` is a sensitive scope: Google app verification may be needed (open, owner).
