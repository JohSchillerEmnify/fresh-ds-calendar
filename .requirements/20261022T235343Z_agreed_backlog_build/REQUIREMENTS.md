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

## Testing Plan

Per group: unit/server test where server behaviour changes, then the targeted e2e scenarios red → green, then
`pnpm --silent verify`; `@visual` + looking at pictures when something visible changed.

## Implementation Plan

1. Group 1: e2e steps (red: 404) → server test (red) → mock guard + hook (green) → docs (API.md, LikeC4). Commit.
2. Group 2 … 4: one commit per group (see sections added below as they are built).
