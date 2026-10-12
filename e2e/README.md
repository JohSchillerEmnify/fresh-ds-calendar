# e2e: executable Gherkin suite

Runs `spec/features/**/*.feature` directly with `@playwright/test` 1.64.0 + `playwright-bdd` 9.2.1
(Chromium, inside `mcr.microsoft.com/playwright:v1.64.0-noble`; versions must match). Lighthouse 13.5.0 is used by the
`@perf` audit step. Workspace package `@calendar/e2e`; not part of the app image (the Dockerfile installs with
`--filter @calendar/server --filter @calendar/web`, and `e2e` is in `.dockerignore`).

## Run

```
pnpm e2e                       # from the repo root: build, start TEST_MODE server on a free port, run all, report
pnpm e2e --project=mobile      # extra args go to playwright
pnpm e2e --grep @year
E2E_BASE_URL=http://localhost:3000 bash e2e/run.sh   # use an already running TEST_MODE server (no build/start)
bash e2e/run.sh --smoke        # @smoke only, against http://cal.mordor.local (--add-host cal.mordor.local:192.168.1.38)
pnpm -F @calendar/e2e steps    # every STEPS.md expression implemented? (exit 1 on a difference)
pnpm -F @calendar/e2e check    # bddgen (fails on undefined steps) + tsc
```

`run.sh` builds the app, starts `TEST_MODE=true PROVIDER=mock SEED=false DATA_DIR=<tmp>` bound to 127.0.0.1 on a free
port (with `--expose-gc`), runs `bddgen && playwright test` in docker with `--network host`, writes the HTML report to
`e2e/playwright-report/`, JSON to `e2e/results.json`, the server log to `e2e/server.log`, and stops the server.
Env: `E2E_SPEC_DIR`, `E2E_SKIP_BUILD=1`, `E2E_SKIP_INSTALL=1`, `E2E_HOST_IP`, `E2E_SOFT_TEST_API=1` (diagnostics: a
failing test-endpoint setup call warns instead of failing). Fallback if the 1.64.0 image is missing: pull
`v1.63.0-noble` and pin both `@playwright/test` and the image to 1.63.0.

Projects: `mobile` (default, 375x812 touch, everything except `@desktop`), `desktop` (1280x800, everything except
`@mobile` and `@perf`). `workers: 1` (one shared mock backend), timezone Europe/Berlin, locale en-GB.

## Layout

`steps/*.steps.ts` by feature area, shared helpers in `steps/support/` (api client, world, dates, ui, forms, tables,
grid, color, cdp, probes in `world.ts`), custom parameter types in `steps/parameters.ts`. State is reset through
`/api/__test/reset` ("the calendar is empty") and again after every scenario.

## Check run against current master (no features implemented)

- `pnpm exec bddgen`: 0 undefined steps. 337 of 337 STEPS.md expressions implemented, 0 extra.
- 690 tests (mobile 356, desktop 334): 4 passed (the `@smoke` health scenarios, which need no test endpoints), 686 failed.
  Failures are expected: master has no `/api/__test/*` endpoints and none of the new UI.
- Duration of that run: about 46 minutes (failing tests wait for timeouts). Use `--project=` or `--grep` while developing.
- `run.sh --smoke` against the deployed site: 4 passed.

## Assumptions and spec ambiguities

1. **Grab point for drags** (STEPS.md: "mouse.down on the chip centre"). In a time grid the step grabs 5 minutes below
   the card top instead, so the drop time is the same if the app positions by pointer or by card top (15-minute snap
   absorbs the offset). Month and all-day targets use the centre.
2. **"I pick up the event"** says "press and hold without moving", but ARCHITECTURE needs > 4 px for a mouse drag. On
   desktop the step presses, waits 500 ms, wiggles 6 px sideways and back (net zero). On touch it holds the touch.
3. **Browser clock**: `the time is D T and the clock is running` installs the fake clock and pauses it 1 ms later, so
   timers (and the app's minute ticker) fire only through `N minutes pass`. Debounces using `setTimeout` also freeze
   in such scenarios. The server clock is set with `frozen:false` (real-time running) and re-set after each advance.
4. **Settings saved wait**: "I choose/enter ..." waits for `PATCH`/`PUT /api/settings` 200, except when the control
   already shows the value (the app may then send nothing).
5. **Plant stage names**: `data-stage` format is not specified ("Small plant" vs `small-plant`); compared ignoring case
   and non-alphanumerics. `plant-card-stage` is compared the same way.
6. **"no reward effect appears"** (1 500 ms after the previous step): implemented as waiting 1 500 ms, then asserting no
   `tick`/`list-complete`/`drop` effect was inserted at any time since page load (superset of the window).
   "appears and is removed within N ms" uses the latest effect of that kind. Lifetimes use a native clock
   (`Event.timeStamp`) so the faked page clock does not distort them.
7. **"opened with an animation"**: `getAnimations().length > 0` right after the step before it; a fast spring that already
   finished would read 0 (inherently racy). "without" requires 0.
8. **Garden style / animation level / calm mode / flame switch controls** are driven through `chooseOption` / switch
   helpers: a native select, radio group, segmented button or switch all work. Switch state is read from `checked`,
   `aria-checked` or `aria-pressed`.
9. **Year view month click**: clicks the month name inside `year-month` if present, else the tile (a click on a day cell
   could mean "open that day").
10. **Month picker swipe**: left = next month, right = previous (like the calendar swipe); on non-touch projects a mouse
    drag is used.
11. **Open tasks tray**: it is expanded with `task-tray-toggle` only when no `task-tray-item` is visible.
12. **Transition warning text** is matched with "contains" (the snackbar also holds a dismiss button).
13. **`the page does not contain the words`** fails if any listed word is present (whole word, case-insensitive).
14. **`at most N app timers`**: `window.__appTimers` may be a number, or an object/array/Set (its size is used).
15. **Progress ring** `aria-valuenow` is rounded to an integer before comparing.
16. **"flower(s)"** counts only visible `sunflower` elements; "swaying" requires all flowers to sway, "not swaying" none.
17. **Weekday parameter** includes the quotes, as in STEPS.md.
18. **JSON results** are written to `e2e/results.json` (inside `test-results/` Playwright would delete them at start).
19. A mobile-project scenario with no `@mobile`/`@desktop` tag also runs on desktop; steps adapt via `hasTouch`.
