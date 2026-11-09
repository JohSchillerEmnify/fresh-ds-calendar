# 0037: A calendar plan sets the hidden flag; nothing else reads the plan

Status: accepted (bug fix, owner 2026-11-09: "You made a second check that checks if there is a schedule, instead of just
setting the hidden status of the calendar ... on the scheduler")

## Decision

A calendar plan (`prefs.calendarPlans`, feature calendar-off-plan) is carried out by a server-side scheduler
(`CalendarPlanScheduler`). At the plan's edges it sets the person's existing `hidden` flag of the calendar (window start:
hidden, window end: shown; "off until" hides now and shows at 00:00 of that day), through the same store call as
`PATCH /api/calendars/:id`, and announces the change like any write. Every reader (web, Android widget, `excludeHidden`,
the change feed) reads `hidden` and nothing else. A tap in between is a plain write of `hidden`; the next edge sets it
again. A restart applies an edge that passed while the server was down and leaves a tap alone otherwise.

## Alternatives

- **Evaluate the plan in every reader (the first version, web only):** the widget, which fetches the server on its own,
  never saw plans (owner bug 2026-11-09). Fixing it meant a second copy of the rule in the server and later in each new
  reader.
- **One shared plan function used by web and server:** one rule, but still two places that decide visibility, and a tap
  needed an extra `switchedAt` marker to tell "tapped" from "scheduled".

## Why this won

One visibility state for all readers, including ones we cannot change quickly (the installed widget). A reader cannot
get it wrong because it has nothing to evaluate. A dependency-cruiser rule keeps the rule file reachable only from the
scheduler and the web plan helpers away from the views.

## Consequences

A device that is offline at an edge shows the old state until its next sync (the flag is server state now). The scheduler
checks every 30 seconds, so an edge shows within about 30 seconds plus the device's sync or the widget's refresh.
`switchedAt` in a plan is ignored (still accepted, old devices may send it).
