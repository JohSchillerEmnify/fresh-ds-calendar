# Build the agreed `@backlog` scenarios (night run 2026-10-22/23)

Owner agreed these scenarios on 2026-10-22. The scenario texts are fixed: nothing in them is reworded. A scenario that
cannot be built as written, or needs an owner decision, stays `@backlog` with the reason in the night report.

## As Is

Each scenario below is tagged `@backlog` (skipped by bddgen/Playwright); some lack step definitions, some lack app
behaviour.

## To Be

The scenarios run (mobile, and desktop unless `@mobile`) and pass; every new step is in `e2e/STEPS.md`.

## Requirements

### R1 (group 1) Google rate limit in the mock — google/sync.feature, Rule "When Google asks the app to slow down…"

R1.1 The mock provider guards its calls with the same `RateGuard` as `GoogleProvider` (ADR 0007), with a fresh-cache
window of 0 so every read still reaches the store (existing sync scenarios keep seeing remote changes at once).
R1.2 Test hook `POST /api/__test/rate-limit { retryAfterSec }`: the next provider call answers "rate limited" with that
`Retry-After`; the guard starts its cooldown; reads answer the last known data marked stale (`X-Stale: 1`), writes fail
`503 RATE_LIMITED`. Reset clears it.
R1.3 Step `Google asks the app to slow down for the next sync` queues a 4 s slow-down and waits for the next stale
`/api/items` answer. `once the slow-down is over I see the event X on D` waits until 4 s after it, then for the event.

Acceptance: server test `testmode.test.ts › rate limit` (stale read, 503 write, fresh after the cooldown, reset, 400 on
bad body); both scenarios green on mobile and desktop; seen red first (404 on the hook).

Assumptions: "for the next sync" = the next provider call (the first call of the next poll); the cooldown length is a
test choice (4 s: longer than the assertions, short against the 2 s poll).

### R2 (group 2) Dialog tap-beside, failed setting, yesterday's timed list

R2.1 `I tap beside the dialog` (events-crud, 2 scenarios): clicks `sheet-scrim` at a viewport corner the open panel does
not cover. The app already closes only a clean dialog (`AdaptiveSheet` `dismissOnScrim = !dirty`): only the step was
missing.
R2.2 "A setting that cannot be saved goes back to what it was": the app already rolls back and shows the banner. Two
step fixes: `the network connection is lost` first waits for `networkidle` (it cut the lazy settings chunk, leaving a
blank page), and `saveSetting` waits for the save request to fail while the browser is offline (it waited for a 200).
R2.3 "A list I did not finish yesterday waits on today without a time": already implemented; tag removed only.

Acceptance: the four scenarios green on mobile and desktop; the other scenarios using the network step stay green.

### R3 (group 3) Labs: approach rows, timeline overlaps, a Labs view by address

R3.1 "Overlapping entries take at most two rows": `approachLayout` already caps at `MAX_ROWS = 2`; step added (distinct
vertical positions of `approach-item`).
R3.2 "Overlapping entries sit side by side on the timeline": step added (vertical overlap, no horizontal overlap). Red:
the timeline packed with `stack = true`, so Review (09:30, 30 min after Dentist) was cascaded on top of Dentist. The
timeline now packs with `stack = false` (overlaps always side by side). Assumption: the agreed scenario (and the
existing code comment "overlaps side by side") is the owner's intent for the timeline; the calendar views keep their
cascade (events-display.feature "stacked on top"), which this does not touch.
R3.3 "A Labs view that is not offered still opens by its address": already implemented; tag removed only.

Acceptance: the three scenarios and the rest of labs-timeline.feature green on mobile and desktop; screenshots looked at.

### R4 (group 4) Tasks filter, Tasks view, Canvas areas

R4.1 "This week ends on Sunday": already implemented; tag removed only.
R4.2 "Deleting an area leaves its notes where they lie" and "A long press on an area moves it": already implemented;
steps added (fixture through `PUT /api/canvas` + `PATCH /api/tasklists/:id { canvas }`, delete through the area
editor, long-press drag with a finger). The fixture's premise (the note is in the area before the delete) was checked
once with a temporary assertion.
R4.3 "Tomorrow puts an undated list in the calendar on the next day": NOT built, stays `@backlog`. The owner removed the
Today/Tomorrow quick actions of the Tasks view on 2026-10-13 (commit fd388b6, "re-date by dragging in the calendar"),
together with this very step; the scenario was re-derived on 2026-10-22 from the feature prose, which still mentions
"Today, Tomorrow". Building it would bring back a removed control: owner decision.

## Testing Plan

Per group: unit/server test where server behaviour changes, then the targeted e2e scenarios red → green, then
`pnpm --silent verify`; `@visual` + looking at pictures when something visible changed.

## Implementation Plan

1. Group 1: e2e steps (red: 404) → server test (red) → mock guard + hook (green) → docs (API.md, LikeC4). Commit.
2. Group 2 … 4: one commit per group (see sections added below as they are built).
