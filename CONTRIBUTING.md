# Contributing

Thanks for helping. By contributing you agree your work is licensed under AGPL-3.0-only (see `LICENSE`).

## Setup

Node >= 24.11 and pnpm (see `packageManager` in `package.json`).

```sh
pnpm install
pnpm verify    # tsc, unit tests, i18n, step contract, quality gates
```

`pnpm verify` and the CI gates (`.github/workflows/ci.yml`, CodeQL) must pass before merge.
CI runs on every PR and push to main: `pnpm verify`, `pnpm audit`, CodeQL, the `@smoke` and `@ci` e2e scenarios (`@ci` marks CI-only ones that need test endpoints, so `@smoke` stays safe against the deployment) and the Android unit tests. PRs from forks wait for the owner's approval before CI runs.
The rest of the Playwright e2e suite (`pnpm e2e`, `pnpm e2e:affected`) is not run in CI; run the relevant scenarios locally.

## Spec-driven workflow

1. Write or change the behaviour in `spec/features/<domain>/*.feature` first, then place it in the LikeC4 model (`docs/architecture/`), an ADR in `docs/adrs/` only for a cross-cutting decision, and `spec/API.md` when the REST contract changes.
   - A scenario proven by a unit test instead of e2e (server start, files on disk) is tagged `@unit` with a `# unit: <file>:<test name>` comment; `check-steps.py` checks the test exists and e2e skips it.
2. Every step phrase must exist in `e2e/STEPS.md`; add new steps there and implement them in `e2e/steps/`. Check with `python3 e2e/scripts/check-steps.py`.
3. Implement until the scenarios and unit tests pass.

## Tooling

Terse output on purpose (one line on success, only failures otherwise); every command finishes in about a minute.

- `pnpm verify`: the gate before any merge or deploy; runs web/server/e2e tsc, server and web unit tests, `i18n:check` and `e2e/scripts/check-steps.py` in parallel (`scripts/verify.mjs`).
- `pnpm i18n:scan [path...] [--json]`: hard-coded UI strings left in `web/src` (template text, label/aria-label/title/placeholder/alt, `notify(` and `new Error(` literals); the template detector is `web/src/i18n/raw-text.ts`, shared with `test/i18n-raw-text.test.ts`. The dev-only `MotionLab.vue` is skipped (`IGNORED`) and three developer-error strings are allow-listed with a reason (`ALLOWED`), both at the top of `web/scripts/i18n-scan.ts`.
- `pnpm e2e:affected [base]`: the Playwright `--grep` for features touched since `base` (default `origin/main`), mapped via feature tags/titles, step definitions and `data-testid` literals (`scripts/e2e-affected.mjs`); `none` if nothing is affected.
- `pnpm goldens [File]` · `pnpm goldens:update [File]`: component golden images (`web/goldens/*.golden.ts`): the calendar item components (`TaskListCard` in every variant and mode, `EventItem`, `EventBar`, `BasicItem`) rendered with fixed props in Vitest browser mode, light + dark, at 360 px and 1280 px, compared pixel for pixel with the baselines in `web/goldens/__screenshots__/`. Vitest runs here, the browser is a Playwright browser server in the Playwright image pinned by digest in `scripts/goldens.sh` (the e2e version; web's `playwright` must match it; bump the version and digest together), with "now" mocked to a fixed date, behind the machine-wide heavy lock (`scripts/goldens.sh`). A mismatch leaves the actual and diff images in `web/test-results/goldens/`. Run it after any change to an item component; only after a deliberate look change run `goldens:update`, look at the new pictures and commit them with the change.
- `npx -y likec4@1.47.0 validate docs/architecture`: the architecture model resolves (exit 1 on any error).

## Reuse first

- New overlays, dialogs and sheets use the shared `AdaptiveSheet`; do not hand-roll a new one.
- New user preferences are registered in one place only; extend the existing mechanism instead of adding parallel settings code.
- Run `pnpm dedup` (jscpd) and do not add duplication; prefer extending an existing helper.
- **Quality gates** (`pnpm quality`, part of `pnpm verify` and CI): dependency-cruiser (layers routes -> services -> stores/providers, no web/server imports except via `shared/`, features only through their `index.ts`, no cycles, no orphans), jscpd duplication, exported type/const names declared in both web and server, ESLint file/function size and complexity plus all warnings, comment style (blocks over 3 lines, dates, owner quotes) and knip (unused files, exports, dependencies).
- **Ratchet:** `quality-baseline.json` holds today's numbers; any increase fails, decreases pass. After you lower a number, run `pnpm quality:ratchet` and commit the new baseline (it refuses to raise anything). A justified increase needs `pnpm quality:ratchet --allow-increase "<reason>"`; the reason is recorded in the file.
- Add or update i18n strings for every locale (`pnpm i18n:check`).

## Commits and PRs

Use conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`). Fill in the PR template.
Report security issues privately, see `SECURITY.md`.
