# Instructions for AI coding agents

Human overview: `docs/DEVELOPER-GUIDE.md`. Details: `CONTRIBUTING.md`, `docs/DEPLOYMENT.md`, `docs/adrs/`.

## Spec-driven development (SDD)
The spec is the single source of truth. Code follows the spec, never the other way round.
1. **Requirements → Gherkin.** Behaviour lives in `spec/features/<area>/*.feature`, one feature per file with an `@id`.
   - Write or change the scenarios before any code.
   - Keep each scenario small and concrete: real dates and names, one behaviour each.
   - Describe what the user sees, not how it is built.
   - Tag not-yet-built scenarios `@backlog`.
   - Configuration (host names, which server) never goes into scenarios.
2. **Steps contract.** Every step sentence must exist in `e2e/STEPS.md` and be implemented in `e2e/steps/`. Check
   with `python3 e2e/scripts/check-steps.py`.
3. **Architecture.**
   - Structure changes go into the LikeC4 model in `docs/architecture/`. Check with
     `npx -y likec4@1.47.0 validate docs/architecture`.
   - A cross-cutting decision gets a short ADR in `docs/adrs/`: the decision, the alternatives, and why it won.
   - REST changes go into `spec/API.md`.
4. **Spec gate.** When a human is available, stop after the spec. Report the scenarios plus a numbered list of
   assumptions and open questions, and build only after they are agreed. UI changes come with a mockup first.
5. **Never route around the spec.** If the specified behaviour is hard, say so. Don't ship an easier variant
   silently, and don't bend a scenario to fit the code.

## Test-driven development (TDD)
1. **Red.** Write the failing test first: a unit test (Vitest, `web/test`, `server/test`) or the scenario as an e2e
   test (Playwright + playwright-bdd run the `.feature` files directly). See it fail for the right reason.
2. **Green.** Write the smallest code that makes it pass.
3. **Refactor.** Clean up while the tests stay green. Reuse what exists before adding anything.
4. **Bugs.** First write a test that reproduces the bug, then fix the root cause.
   - Find the cause by listing every plausible hypothesis and settling each one with evidence: logs, a reproduction,
     or a throwaway test.
   - Never patch on a guess.
5. **Looks.**
   - After any change to an item component, run `pnpm goldens`.
   - For UI work, look at the screenshots at phone size. Green DOM checks are not proof that it looks right.

## Gates and tools
- **`pnpm verify` before every merge or push.** It runs tsc, the unit tests, i18n, the step contract, duplication and
  lint, in about a minute.
- **e2e: targeted only.**
  - `pnpm e2e:affected` gives the `--grep`.
  - Run it with the mobile project and `--workers=1`.
  - Never run the full suite and never `@perf` unless a human asks.
- **Commits:** small, with conventional messages (`feat:`, `fix:`, `docs:`, `test:`, `chore:`), which drive the version
  number. `git add` named files, never `-A`.

## Rules
- **Reuse before adding:**
  - `AdaptiveSheet` for overlays;
  - the one prefs mechanism for settings;
  - the existing item renderers and stores.

  `pnpm dedup` must not grow.
- **Strings and test hooks:**
  - Every UI string goes through i18n in all locales; `pnpm i18n:scan` finds hard-coded ones.
  - Test hooks use `data-testid`.
- **Comments are TL;DR:** explain *why* in one line. No history, dates or quotes in code; those belong in commits and
  ADRs.
- **Data is device-first:** anything the app shows must be readable offline from the device copy (ADR 0023/0025).
- **Nothing private in the repo:** no secrets, tokens, real host names, IP addresses or e-mail addresses. Use
  `cal.example.org`, `example.test` and the configuration settings (`CAL_DOMAIN`, `.env`).
  Guards: `pnpm hooks:install` (pre-commit/pre-push) and CI run `scripts/leak-check.sh`; your own values go in
  `~/.config/calendar/leak-denylist`, never in the repo.
- **Git:**
  - No `git stash`: worktrees share one stash.
  - No force-push.
  - No deploy unless a human asks.
- **Parallel agents:** each one works in its own worktree (`../calendar-wt/<name>`), one feature per branch.

## Report back with
- the files changed;
- what you verified, with commands and results;
- an explicit list of assumptions and ambiguities.
