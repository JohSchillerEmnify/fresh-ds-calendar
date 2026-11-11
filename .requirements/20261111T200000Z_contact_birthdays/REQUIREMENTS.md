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
5. All dates of a contact: birthday, anniversary (title = name, ring) and other/custom (`<label>: <name>`, no marker).
6. Device-first: part of the change feed, readable offline (ADR 0023/0025).
7. Per person: own token, own sync token, own events.
8. Permission: not asked at sign-in, nobody is logged out. While missing, the app's standard snackbar `contacts-offer`
   (persistent, "Show birthdays from your Google Contacts too?", action "Allow" -> `start?contacts=1`, ✕ = not now, for good); it stops once granted; dismissal is a per-person pref
   (`contactsOfferDismissed`). The Birthdays settings page always offers the same link while the permission is missing, also after dismissing (owner decision). An absent permission or a failing People API
   never breaks the other birthdays or the calendar.

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

## Decisions
Owner, quoted exactly:
- Permission: "we log out no one but we send a message "to allow birthdays from contacts to be shown yada yada" with a link one can click to allow it"
- Other dates: "All dates"
- Age: "In details only"
- Message style (option S on the mockup board, "the app's standard snackbar"): "use this."
- Allow link in Settings > Calendars > Birthdays after dismissing: "yes of course we should always have an option to allow that"
- Earlier: "the contact bds should also be visible." and, on the Birthdays calendar, "ok, but it's only a virtual cal right?" (confirmed: it exists only in the app).
- The Google OAuth app is in Testing mode, so `contacts.readonly` needs no verification (stated by the owner side; no question left).

## Assumptions and open questions
Assumptions:
1. The message is the standard snackbar (`ui.notify`, `duration: 0`, pattern of `native/apkHint.ts`); no new notice mechanism.
2. The message is dismissed for good, per person (a pref, also across devices).
3. The message shows when signed in, the calendar works and the permission is missing; it stops once granted.
4. Anniversary: titled and marked like a calendar anniversary (the name, the ring). Custom date: "<label>: <name>", no marker. Other without label: the name, no marker (a guess).
5. Age only for birthdays with a year, in the details ("Turns N"); anniversaries and other dates show none.
6. Dedupe by resource name and same kind, else same title (case-insensitive) and day; the calendar event wins.
7. Contacts without a display name are skipped.
8. The hint "Change this birthday in Google Contacts" is also used for anniversaries and custom dates (wording is a draft; other locales not drafted).
Open: none beyond the draft wording and the "other date" title.
