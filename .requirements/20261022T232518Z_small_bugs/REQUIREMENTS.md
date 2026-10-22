# Small bugs from the backlog (night run 2026-10-23)

Three bugs from `docs/BACKLOG.md`, each its own commit on `fix/small-bugs`. The owner is asleep; assumptions are
recorded here and in the final report.

## 1. Deep-link return after sign-in is sometimes lost

### As Is
Opening `/week/2026-10-12` while signed out: `main.ts` registers the 401 listener (`useAuthStore().listen()`), then
fires `auth.check()` plus config/settings/theme loads and waits for all of them before it creates the router. The
`/api/auth/me` 401 makes the listener call `location.assign('/signin')` (a full page load) at once. The router guard
that stashes the deep link in `sessionStorage[RETURN_KEY]` only runs after the other loads settle; if the `/signin`
document commits first, the page unloads without the key and the post-sign-in `/` redirect falls back to the default
view (~1 in 8 runs of "An allowed person signs in with Google and sees their calendar").

Root cause evidence:
- Trace of a failing run: `GET /api/auth/me 401` at t=67805.8 ms, `GET /signin` (document) at t=67817.7 ms, i.e. the
  listener's full-page jump, before the router existed. Callback lands on `/` as expected (falsifies "lands elsewhere").
- Probe (temporary, reverted): delaying `/api/settings` by 800 ms made the failure deterministic (4/4), and
  `sessionStorage['signin-return']` was `null` already on the sign-in page, so the key is never written (falsifies
  "written, then consumed/cleared before the callback"). With the fix the same probe shows `/week/2026-10-12` and 4/4 pass.

### To Be
Whoever sends the person to `/signin` stashes the page being left first. The 401 listener writes
`pathname + search + hash` to `RETURN_KEY` before `location.assign('/signin')` (except for `/`, like the router guard).

### Requirements
1. R1: a 401 (`UNAUTHENTICATED`) answer on a page other than `/` and `/signin` stores that page in `RETURN_KEY` before
   leaving for `/signin`.
2. R2: on `/` nothing is stored (the default view is the default anyway).

### Acceptance Criteria
- R1: unit test "remembers the page it leaves for the sign-in page, before leaving" (value read at `assign` time).
- R1: `e2e-locked --grep "and sees their calendar" --repeat-each 8` 8/8 and `--repeat-each 16` 16/16 green.
- R2: unit test "remembers nothing for the start page".

### Testing Plan
Unit tests in `web/test/stores.test.ts` (red first), then the repeated e2e scenario.

### Implementation Plan
1. Failing unit tests → 2. stash in `listen()` → 3. unit green, e2e repeat runs green. One commit.

### Assumption
A 401 in the middle of a session (session expired while using the app) now also returns to the page that was open,
after signing in again. This follows the backlog's intent ("opening a specific page while signed out should return
there after sign-in"); before, that case always landed on the default view.
