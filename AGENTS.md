# Instructions for AI coding agents

Human overview: `docs/DEVELOPER-GUIDE.md`. Details: `CONTRIBUTING.md`, `docs/DEPLOYMENT.md`, `docs/adrs/`.

## How work is done here
1. **Spec first.** Behaviour lives in `spec/features/<area>/*.feature` (Gherkin, each feature has an `@id`). Write or
   change the scenarios before any code; new, not yet built scenarios are tagged `@backlog`. Every step sentence must
   exist in `e2e/STEPS.md` (`python3 e2e/scripts/check-steps.py`). Cross-cutting decisions get a short ADR in
   `docs/adrs/`; structure changes go into the LikeC4 model (`npx -y likec4@1.47.0 validate docs/architecture`).
2. **Stop after the spec when a human is available** and list your assumptions and open questions. Build only after
   the scenarios are agreed.
3. **Test first.** A failing unit test or scenario, then the code, then green.
4. **`pnpm verify` before every merge or push** (tsc, unit tests, i18n, step contract, duplication, lint, ~1 min).
5. **e2e: targeted only.** `pnpm e2e:affected` gives the `--grep`; run those scenarios on the mobile project with
   `--workers=1`. Never the full suite and never `@perf` unless a human asks for it.
6. **Small commits** with conventional messages (`feat:`, `fix:`, `docs:`, `test:`, `chore:`); `git add` named files,
   never `-A`.

## Rules
- Reuse before adding: `AdaptiveSheet` for overlays, the one prefs mechanism for settings, existing item renderers and
  stores. `pnpm dedup` must not grow.
- Every UI string goes through i18n (all locales; `pnpm i18n:scan` finds hard-coded ones). Test hooks use `data-testid`.
- Data is device-first: anything the app shows must be readable offline from the device copy (ADR 0023/0025).
- **Nothing private in the repo:** no secrets, tokens, real host names, IP addresses or e-mail addresses. Use
  `cal.example.org`, `example.test` and the configuration settings (`CAL_DOMAIN`, `.env`).
- Don't use `git stash` (worktrees share one stash), don't force-push, don't deploy unless a human asks.
- Parallel agents work in separate worktrees (`../calendar-wt/<name>`), one feature per branch.

## Report back with
The files changed, what you verified (commands + result), and an explicit list of assumptions and ambiguities.
