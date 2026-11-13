# Instructions for AI coding agents

Human overview: `docs/DEVELOPER-GUIDE.md`. Details: `CONTRIBUTING.md`, `docs/DEPLOYMENT.md`, `docs/adrs/`.

## Spec-driven development (SDD)
The spec is the single source of truth. Code follows the spec, never the other way round.
1. **Requirements → Gherkin.** Behaviour lives in `spec/features/<area>/*.feature`, one feature per file with an `@id`.
   - Write or change the scenarios before any code.
   - Keep each scenario small and concrete: real dates and names, one behaviour each.
   - Describe what the user sees, not how it is built.
   - Tag not-yet-built scenarios `@backlog`.
   - Tag scenarios that only a unit test can prove (server start, files on disk) `@unit` and name the test in a `# unit: <file>:<test name>` comment; `check-steps.py` verifies it and e2e skips them.
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
- **`pnpm verify` before every merge or push.** It runs tsc, the unit tests, i18n, the step contract, duplication, lint and
  the changelog gate (a `feat`/`fix` branch must change `CHANGELOG.md`), in about a minute.
- **Quality gates are a ratchet.** `pnpm verify` also runs `pnpm quality`: architecture layers (dependency-cruiser), duplication,
  web/server type duplicates, size/complexity/comment limits, dead code (knip), colour literals and fixed px font sizes in `.vue` files, and text-contract findings in the en/de catalogues (`pnpm ui-texts` lists them). `quality-baseline.json` holds today's numbers: any
  increase fails. When you lower one, run `pnpm quality:ratchet` and commit the file; raising needs `--allow-increase "<reason>"`.
- **e2e: targeted only.**
  - `pnpm e2e:affected` gives the `--grep`.
  - Run it with the mobile project and `--workers=1`.
  - Never run the full suite and never `@perf` unless a human asks.
- **What's new:** a `feat`/`fix` branch adds one or two plain, user-facing English bullets under today's `## YYYY-MM-DD` in `CHANGELOG.md` (test, tooling, spec-only: none); `pnpm verify` enforces it. — Users read the in-app release notes, and a skipped day of merges left them empty.
- **Commits:** small, with conventional messages (`feat:`, `fix:`, `docs:`, `test:`, `chore:`), which drive the version
  number. `git add` named files, never `-A`.

## Rules
- **Don't reinvent the wheel:** before writing infrastructure (storage wrappers, rate limits, recurrence, gestures, sync, parsing), use a maintained library or an existing store in the repo; check its current docs first. Any own implementation needs a one-line reason in the report.
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

## Working rules
Each rule has its reason after the dash. The rules above (spec first, red test first, root cause by evidence,
targeted e2e, `pnpm verify`, named files, no stash or force-push, device-first, reuse libraries) apply as well.
`.claude/agents/track-builder.md` is the fixed build agent that carries all of them.

### Process
- **Size the process to the change.** A fix with a known cause takes the short path: one test that is red before and
  green after, only the scenarios and `@visual` pictures it can change, one review pass, report. Features take the full
  routine with `.requirements/<UTC datetime>_<feature>/REQUIREMENTS.md`. — A four-line fix must not cost an hour.
- **One review pass.** A second only for a blocking finding. Never re-run a green set "to be sure". — Reviews and
  e2e runs cost shared time and tokens.
- **Keep output short.** Read files by section, show test results as counts and failing names. — Long logs burn context.
- **Throttle tests.** Run them with `nice -n 10` and at most 4 Vitest workers, one full `pnpm verify` at the end, no
  repeat or stress loops. — Parallel agents share one machine.
- **Never hide a gate's exit code.** No `gate | tail && next`; run the gate bare or use `set -o pipefail`. — A pipe
  made a failed leak check look green.
- **Budgets are ceilings, not targets.** Don't lazy-load or delay things only to shrink first-load size; a justified
  increase goes in with `--allow-increase "<reason>"`. — Chasing the number added complexity and one-time growth.
- **Expensive tests may wait for the nightly CI.** `@perf`, memory and other long runs may be left to
  `nightly-e2e.yml`; running one locally is fine when it is the faster way to an answer. — It is permission, not a ban.
- **Ask only real decisions.** Settle obvious ones yourself and say so in one line; check the spec, the issue and
  `spec/ASSUMPTIONS.md` first and never re-ask an answered question. — Obvious questions waste the owner's time.
- **Never remove a feature silently.** If something is wrong or misleading, fix it; removing anything users or the
  owner rely on needs an explicit OK. — Removal changes what people depend on.
- **Precise terms.** *Host name*, *URL* and *domain* are not "addresses" (that is an IP address); a *virtual calendar*
  exists only in the app, a *Google calendar* exists in Google; say whether a setting is stored in the app or sent to
  Google. — Loose words made readers think data had been written somewhere it had not.

### Spec & tests
- **Never route around the spec** (see above), and never present spec wording as the owner's decision unless the
  words are on record in a requirements file, ADR or issue; otherwise say "the spec says". — Wording written by an
  agent is not a decision.
- **A removal is specified and pinned.** When something is dropped or forbidden, write it into the spec and pin it with
  a test in the same change. — A request that lives only in chat or one grid comes back.
- **Read the docs before using an API.** Check the current documentation for every new external call (Google, a
  library, a platform) before writing code. — "From memory" produced wrong semantics.
- **Never guess.** Versions, compatibility, permissions, platform behaviour and reasons ("why is it like this") are
  looked up (official docs, release notes, web search, the repo's code and history) and the source is named in the
  report; what could not be checked is marked "unverified". — Guessed answers cost the owner hours of correcting.
- **A mock must behave like the real service.** For each new Google call, make the mock follow the documented
  semantics, including what the call does *not* change. — Green tests against a too-friendly mock proved nothing.
- **Gates stay in step with the spec.** Spec text, `e2e/STEPS.md`, step code and `@unit` comments change together;
  `check-steps.py` must report 0 problems.

### UI
- **Look at it.** A UI change is done only after the `@visual` scenarios ran and every affected picture was opened at
  phone size (375×812), in every affected state (collapsed, grown, tight, all-day band, week, dark). Re-record
  baselines only for intended changes, after looking; never a bare `--update-snapshots`. — Green DOM checks moved the
  breakage to states nobody looked at.
- **Build to the stated look.** Read the spec section and the owner's rules first; no self-invented designs. If a rule
  would make one state look wrong, ask before building it. — Changes are welcome, invented ones are not.
- **Check what a screen is for** before placing a feature in it: read the component's doc comment and feature id, and
  prefer the place that already holds that object's settings. — A setting landed in an unrelated sheet.
- **Opinionated, one look.** The design is aligned and consistent everywhere: a look is changed once, in the shared `m3` component, and every screen follows. No opt-in props or variants for a new look while the old one stays the default, no per-screen `:deep` restyling of kit parts; an audit reports causes per component, not per screen. — The create switcher stayed on the old look because the new one was an opt-in only settings used.
- **One action vocabulary.** Buttons and icon buttons come from the `m3` kit; no new pill or icon variants per
  feature, mockups included. — Mixed styles clutter the UI.
- **Scene art fills the whole bar.** Ground cover runs the full width; only characters and large props stay clear of
  controls, at the size the bar allows, spread over all free areas. — Props squeezed into one gap looked tiny.
- **User-facing texts are for users.** Plain language, one short sentence on what changes for the user, no
  implementation, version or history words, no hint that repeats its label; German reads like a native wrote it.
  Contract: `docs/UI-TEXTS.md`. — Code-speak leaked into settings hints.

### Data
- **Everything is per person.** Every setting and piece of user data is keyed by the person; only explicitly shared
  things (shared task lists) cross people. Review new server stores for this. — One person's change must never alter
  another person's app.
- **One rule, one place.** Prefer driving an existing state (e.g. the `hidden` flag) over teaching every reader a new
  rule. If a rule decides what a person sees (visibility, plans, filters), put the pure function in `shared/` and
  name every consumer: web stores, server routes, widget. — A web-only rule left the widget ignoring it.
- **New data is device-first from the start** (see Rules): cached on the device and shown offline; reading data that
  "needs a connection" is a blocker in review. — Retro-fitting the cache cost a rewrite.

### Git & GitHub
- **Reopen, never re-issue.** When something from a closed issue turns out not done, or a fix of it caused the problem, reopen that issue with a comment on what is missing and close the fix with `Fixes #<old>`; a new issue is only for genuinely new behaviour. Search closed issues, the spec and the ADRs first. — New issues for unfinished work showed broken things as done and made the owner explain them again.
- **What's new in the same branch.** Every user-visible `feat`/`fix` brings its `CHANGELOG.md` bullets before it merges; `pnpm verify` fails without them. — The rule lived only in `docs/DEPLOYMENT.md` and was skipped.
- **Issue first.** Every piece of work has a GitHub issue before the first commit; the branch is `<type>/<N>-<slug>`
  (`feat`, `fix`, `docs`, `chore`, `test`, `refactor`) and a commit or the merge says `Fixes #N`. — Board and issue
  closing are derived from this.
- **Anonymised wording in everything that reaches GitHub** (commit messages, issue and PR titles and bodies,
  comments): "a user", "another user". No names, no relationships, no gendered pronouns, no private host names. The
  commit-msg hook and the `gh` guard refuse personal words. — The repo is public.
- **Work in your own worktree and branch** (`../calendar-wt/<name>`), never in the main checkout or another
  worktree. Commits on your own branch are allowed and expected, small and conventional; stage named files only.
  Build agents never push, merge or deploy; the coordinating session does. — Strays in a shared checkout got swept into commits.
- **Ship when the owner says ship; never park.** "Ship"/"deploy" or night-shift mode means: merge and deploy every
  ready track and build every agreed one, without asking again. "Don't ship" means don't. Hold a track only when you
  are unsure or it needs a behaviour change nobody agreed on, and say so at once. — Parked tracks sat for whole nights
  about five times because this rule lived only in notes while this file said "only when asked".
- **Clean up behind you.** After a merge remove the worktree folder and the branch; leave no debug folders, copies or
  logs next to the repository. — Leftovers pile up and stale refs can carry unscrubbed history.
- **ADR numbers.** Take the highest existing number plus one, checked against `main` right before committing, and add
  the row to `docs/adrs/README.md`. — Parallel branches clashed on the same number.
- **After a push to `main`, read the CI result** (`gh run list --branch main --workflow CI --limit 1`); a red main is
  fixed before the next feature ships, and changed native dependencies need an Android build or the Android CI result
  before merge. — `pnpm verify` runs no Gradle tests.

### Production & secrets
- **Agents never deploy and never hold secrets.** No `.env`, signing key, tokens or secret-store writes; report what
  is needed instead. Production changes are run by a human or by GitHub CD. — A deploy race rolled production back.
- **One deploy path: GitHub CD deploys `main` after a green CI run.** Use `scripts/vps.sh deploy` by hand only when
  CD is off or a human asks. A deploy that contains native changes (`android/`, widget, Capacitor plugins) ships the
  APK with it; CD builds, signs and ships it (ADR 0040), so check that its APK jobs went green. — Two deployers
  raced; web-only deploys left the app without the feature.
- **Debugging from logs: read the unfiltered recent log first,** narrow only afterwards, and check that a probe sends
  what you think (`curl -v`) before calling anything confirmed. — A narrow filter hid the answer for an hour.
- **Give humans short commands.** Anything long goes into a script; one line they can copy. — Wrapped lines break.

## Repo rules vs. general assistant rules
An agent may also load general rules (a global rule file or skills). For work in this repo, this file wins; general
rules fill gaps only. Where they differ:

| Topic | General rule | Here |
|---|---|---|
| Requirements | A `REQUIREMENTS.md` before every task | Behaviour lives in `spec/features/**/*.feature`; `.requirements/<UTC datetime>_<feature>/REQUIREMENTS.md` holds assumptions and plan for **features** only; a small fix skips it |
| System design | `.system_design/SYSTEM_DESIGN.md` and a `steps/` folder | The LikeC4 model (`docs/architecture/`), ADRs (`docs/adrs/`) and `spec/API.md`; no `.system_design/` folder unless one is added on purpose |
| Commits | Never commit on your own initiative | Commit on your own branch, small and conventional; ship (merge + deploy) when the owner says ship and always in night-shift mode, never park |
| Tracker | Jira or Confluence | GitHub issues; branch `<type>/<N>-<slug>`, `Fixes #N` |
| Confirm requirements first | Ask before implementing | Same: the spec gate stops after the scenarios while a human is available; with none (unattended run, night shift) build through, merge and deploy, and record assumptions for review |
| Reviews | Repeat until no findings | One pass, a second only for a blocking finding |
| Docstrings | A docstring on every function, comment blocks per logical block | TypeScript here: a one-line *why* comment where needed; the comment gate fails blocks over 3 lines, dates and quotes |
| Debugging | Falsify hypotheses | Same, and the reproducing test comes first |

## Report back with
- the files changed;
- what you verified, with commands and results;
- an explicit list of assumptions and ambiguities.
