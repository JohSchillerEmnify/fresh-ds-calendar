# 0039: Holiday regions are a curated list of verified Google calendars

Status: accepted (owner request, issue 60; assumptions listed in the requirements file)

## Decision

The app offers holiday calendars from a curated list of 65 countries (ISO code to Google's id slug,
`server/src/providers/holidayRegions.ts`). A calendar id is `<lang>.<slug>[.official]#holiday@group.v.calendar.google.com`:
`lang` is the app language (`de`, `en`, anything else falls back to `en`), `.official` is the public holidays only, without
it the holidays and observances. Before the server offers a region it checks each id with `calendars.get` (a 404 falls back to
a one-event `events.list`) and leaves out one Google does not know; the answer is kept in the process for 24 h. Adding is
`calendarList.insert`, removing `calendarList.delete`, in the person's own Google list. A subscribed holiday calendar is an
ordinary calendar of the list (switch, colour, events, change feed) flagged `holiday: true` for the Settings section. The
server builds every id itself; a client never sends one.

## Alternatives

- **Tell the person to add holidays in Google Calendar (a hint):** the owner's fallback only; the picker works.
- **Let the person type any calendar id:** unverifiable, a phishing-like way to subscribe to arbitrary calendars.
- **Scrape or ship Google's "interesting calendars" list:** Google has no API for it; a copied list silently rots. A curated list
  checked at run time shows only what exists today.
- **State-level calendars (German Länder):** Google has none (every probe of a state slug answers an error), so none are offered.
- **Third-party holiday data (Nager.Date, Calendarific):** a second source of truth beside the person's Google list, with its own
  quota and availability; subscribing keeps one calendar mechanism.

## Why this won

Holiday calendars become calendars like any other, so the device copy, offline reading, switches, colours and plans need no
new code path. The curated list plus run-time verification keeps the ids honest without inventing any. Cost: the list is ours
to maintain, and the first picker opening of a day makes about 130 `calendars.get` calls (concurrency 6).
