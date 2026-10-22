# Spec and e2e cleanup, coverage-preserving part (night run 2026-10-23)

Backlog items "Review and prune the e2e suite" and "Clean up the spec" (docs/BACKLOG.md). The owner allowed tonight
only changes that keep coverage; everything else is a proposal in `docs/proposals/2026-10-23-spec-e2e-cleanup.md`.

## As Is

- 701 scenarios outside the four files other tracks change tonight (reminders, android-app, bedtime, dnd).
- `e2e/STEPS.md` is `merge=union`; the theme-import notes exist twice (an older copy in "Theme import", a newer one
  stranded under "Tasks view" with its first line cut off). Two section headings lack the blank line before them.
- `e2e/scripts/check-steps-impl.py` reports 90 missing / 6 extra: it does not unescape `\'` in TS literals and does not
  read `Then("...")` literals, and one dead step (`I do not see the now card`, dropped from the spec in 0712a5d) is
  still implemented. (The task text said 25 / 6; the measured baseline on main 3859f72 is 90 / 6.)
- A few scenarios are exact duplicates by meaning, a few differ only in values, a few names no longer say what the
  steps check.

## To Be

- STEPS.md defines every expression once and every note once, in its own section; check-steps stays 0 / 0.
- check-steps-impl reports only real differences (73 missing, all @backlog-only; 0 extra).
- Duplicates removed, value-only twins merged into Scenario Outlines, misleading names renamed; steps unchanged.
- Everything that changes coverage or needs an owner decision is listed as a tickable proposal.

## Requirements

1. R1 Dedupe the union-merged STEPS.md notes without losing any information.
2. R2 Make check-steps-impl read every step literal the implementation uses (mechanical).
3. R3 Remove a scenario only when another scenario has the same Background, Given and When and a Then that checks at
   least the same (assumption: "near-exact duplicate" = identical setup and action, subset check).
4. R4 Merge scenarios into a Scenario Outline only when they have the same steps, tags and rule, differ only in
   values, and their names describe one behaviour (assumption: two scenarios that state two different rules, e.g.
   min-event-length "drawn as long as the minimum" / "keeps its real length", stay separate for readability).
5. R5 Rename a scenario only when its name claims something its steps do not do; never change steps.
6. R6 Do not touch reminders.feature, android-app.feature, bedtime.feature, dnd.feature, any @backlog scenario, app code.
7. R7 Write the proposals file (drop / unit-test candidates, contradictions, verdict-style Then steps, time estimate).

## Acceptance Criteria

- AC1 (R1) `python3 e2e/scripts/check-steps.py` → 0 unused, 0 problems; every bullet of the removed copy is present
  (newer wording) in "Theme import".
- AC2 (R2) check-steps-impl ≤ 90 missing / ≤ 6 extra (target 73 / 0); `cd e2e && npx bddgen` succeeds.
- AC3 (R3–R5) every changed or merged scenario passes in one targeted run (mobile; desktop too when not @mobile); a
  merged Outline that fails where the originals passed is reverted.
- AC4 (R6) `git diff main --stat` touches none of the excluded files and no `src/`/`server/` code.
- AC5 (R7) proposals grouped by feature, one line of reason each, with the scenario name and a checkbox.
- AC6 `pnpm --silent verify` prints `verify: OK`.

## Testing Plan

- Static: check-steps, check-steps-impl, bddgen after every spec change.
- Targeted e2e (`pnpm run build:e2e`, then `E2E_SKIP_BUILD=1 e2e-locked --grep "<exact names>"`, plus
  `--project=desktop` for scenarios without @mobile), once for all changed scenarios.
- `pnpm --silent verify` at the end.

## Implementation Plan

1. STEPS.md dedupe + blank lines → check-steps. (commit)
2. check-steps-impl unescape + double quotes, drop the dead now-card step → check-steps-impl, bddgen. (commits)
3. Spec edits: one duplicate removed, three Outline merges, six renames → check-steps, bddgen, targeted e2e. (commit)
4. Proposals file. (commit)
5. verify. One PR for the whole branch (all changes are small and of one kind).

## Implementation notes

See the final report of the night run and the commit messages on `chore/spec-e2e-cleanup`.
