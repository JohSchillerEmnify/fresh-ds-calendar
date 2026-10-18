# Contributing

Thanks for helping. By contributing you agree your work is licensed under AGPL-3.0-only (see `LICENSE`).

## Setup

Node >= 24.11 and pnpm (see `packageManager` in `package.json`).

```sh
pnpm install
pnpm verify    # tsc, unit tests, i18n, step contract, duplication, lint
```

`pnpm verify` and the CI gates (`.github/workflows/ci.yml`, CodeQL) must pass before merge.
The Playwright e2e suite (`pnpm e2e`, `pnpm e2e:affected`) is not run in CI; run the relevant scenarios locally.

## Spec-driven workflow

1. Write or change the behaviour in `spec/features/*.feature` first (and `spec/ACCEPTANCE.md` / `spec/ARCHITECTURE.md` / `spec/API.md` when relevant).
2. Every step phrase must exist in `spec/STEPS.md`; add new steps there and implement them in `e2e/steps/`. Check with `python3 spec/scripts/check-steps.py`.
3. Implement until the scenarios and unit tests pass.

## Reuse first

- New overlays, dialogs and sheets use the shared `AdaptiveSheet`; do not hand-roll a new one.
- New user preferences are registered in one place only; extend the existing mechanism instead of adding parallel settings code.
- Run `pnpm dedup` (jscpd) and do not add duplication; prefer extending an existing helper.
- Add or update i18n strings for every locale (`pnpm i18n:check`).

## Commits and PRs

Use conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`). Fill in the PR template.
Report security issues privately, see `SECURITY.md`.
