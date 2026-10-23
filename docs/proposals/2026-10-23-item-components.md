# Item components: audit, what was done, proposals for the owner (2026-10-23)

Backlog tech debt "Simplification & reuse audit of the overview item components" (owner, 2026-10-16: "why do we have
so many variants of what should be one dynamic component?"). Branch `refactor/item-components`. Tonight's rule:
behaviour- and look-preserving only, every picture identical, nothing re-baselined. No behaviour changed, so the spec is
unchanged; the element structure of the LikeC4 model is unchanged (the item renderers are not modelled separately), so
`docs/architecture/models/web.c4` is unchanged.

## Safety net (built first, from the unchanged components)

- **Component goldens** (`pnpm goldens`, `pnpm goldens:update`, CONTRIBUTING "Tooling"): Vitest browser mode renders
  `TaskListCard` (card, all-day full + titles, block wide / mini / inline / short, chip, dot, grown down / up / tight /
  flat / all-day / untitled, calm, categories, resize handles), `EventItem` (chip, all-day, dot, block tall / short /
  narrow / continued, calm, resize handles), `EventBar` (band and month chip, continued ends) and `BasicItem`, plus every
  entry skin (neon / soft glow, tinted, outline, pill / square corners), light + dark at 360 and 1280 px. Compared pixel
  for pixel (pixelmatch threshold 0, 0 pixels allowed). Browser = Playwright server in the pinned e2e image, behind the
  heavy lock. 72 baselines in `web/goldens/__screenshots__/`, each taken before the step that could move it.
- The `@visual` e2e pictures (12 scenarios, green on the untouched branch and after every step).
- A throwaway full-screen pixel guard (month, week, day ×2, two-row week with titled, titleless, complete, short,
  mini and inline lists) run before and after every step; not committed.

## Audit

| Component | Variants / modes | Who passes what |
| --- | --- | --- |
| `TaskListCard` | `card`, `allday`, `block`, `chip`, `dot`; modes `grown`, `flat`, `mini` (measured < 92 px), `titles` (band section mode), `tight`, `up`, inline / short block (measured height) | Month, zoom month, zoom timeline, horizontal time: `card`; time grid band, strip, timeline: `allday`; grids: `block`. **Nobody passes `chip` or `dot`.** |
| `EventItem` | `dot`, `chip`, `allday`, `block`; `narrow` (measured ≤ 76 px) | `chip` / `allday` / `block`. **Nobody passes `dot`.** |
| `EventBar` | band bar, `chip` (month) | TimeGrid band, MonthView |
| `BasicItem` | event + task list fallback | The extension registry's renderer when a feature is not registered (unit tests of views, a feature switched off). Not a duplicate of a live path. |

Findings:

1. The variant is a *host* fact (has a time axis → `block`; in a band → `allday`; in a month cell → `card`/`chip`); the
   *space* facts are already measured (`mini`, `narrow`, inline, short block, fade). So "one dynamic component driven
   by size" mostly exists inside each renderer; what was missing was one place for each rule. The per-variant CSS is
   the real bulk (TaskListCard ≈ 190 lines of CSS, a third of it for `grown`).
2. The rules that had to be changed in several places: the fit ladder + titleless lead (4 computeds), "does this block
   show its resize handles" (2 renderers), the phone fade mask (4 copies), the block ring/shadow (3 copies).
3. Dead code: `chip` and `dot` for task lists, `dot` for events (+ CSS). Three unit tests mount the card as `chip`.
4. jscpd today: 14 clones / 0.62 % (the backlog's 23 / 0.78 % is out of date; DayView↔WeekView, TaskTray↔TasksView and
   ExpandedTaskList↔TaskListView are already gone).

## Done tonight (each step: unit tests, `pnpm --silent verify`, goldens, `@visual`, guard — all identical)

1. Goldens tooling + baselines (above).
2. `cardLayout()` in `features/tasklists/layout.ts`: the one pure function that decides fit, inline, short block,
   time foot and the titleless lead; 8 unit tests pin every branch (the lead had none). `TaskListCard` renders its
   result. "Titleless shows its first item" is now one line.
3. `showsHandles()` in `features/calendar/resize.ts`: one rule for when an event or task list block draws its resize
   handles (unit-tested); resize e2e scenarios green.
4. `--fade-end` token (theme.css) for the clipped one-line title fade (EventItem ×2, EventBar, TaskListCard mini).
5. `--block-sh` token on `.skin` for the time grid block ring + shadow + glow (EventItem, TaskListCard, grown pill).
6. `useSaveSettings()`: the Settings and Theme screens' shared save (banner or snackbar), unit-tested.
7. Labs horizontal week + zoom month: `useDaySegments({ withSpans: true })` (multi-day events on each day, unit-tested)
   and `useLoadDays(days)` instead of two copies. jscpd: 14 clones / 0.62 % → 12 / 0.59 %.

## Proposals (need your tick: they remove golden states or change the component contract)

- [ ] **Remove the dead variants**: `chip` + `dot` from `TaskListCard`, `dot` from `EventItem` and `ItemVariant`.
  No view passes them; ≈ 15 CSS lines and 3 template branches go. Costs: the `chip-dot` golden and the `dot` cell of
  the EventItem chip golden are deleted (no app picture changes), three unit tests mount `card` instead of `chip`.
- [ ] **Split `TaskListCard` by state, not by variant**: `TaskListCard` (collapsed) and `GrownTaskListCard` (the
  expanded pill + extension, today `grown` with ≈ 70 lines of CSS of its own and `flat`/`tight`/`up`), sharing a
  `TaskListHead` (checkbox, icon, title / lead, badges, count). The grown card is a different look with its own owner
  spec (pill + list, two containers), so mixing it with the collapsed card's CSS is what makes each change risky.
  Goldens make this safe; it is the biggest simplification left. Owner call because it reshapes the component the
  grown-card spec talks about.
- [ ] **One entry shell** for `EventItem` and `TaskListCard`: root `<button>` with skin, ripple, `--c`/`--on-solid`,
  drag hookup (`useCalendarDrag`), resize handles and the block box. The content stays per kind. Touches the drag
  hookup of both renderers; worth it once the shell has one more user.
- [ ] **One month-chip look** shared by `EventItem.chip`, `EventItem.allday` and `EventBar.chip` (same height,
  padding, type, phone fade). Today three scoped copies that must be changed together.
- [ ] Keep `BasicItem` (the registry fallback) but give it the real look via the shared shell, or drop it and make
  the two features mandatory. Owner call: it is part of the plugin architecture.
- [ ] Ratchet `.jscpd.json` `threshold` from 0.68 down to the new figure after this branch is merged.

## Not done, and why

- Anything that would change a golden or `@visual` picture (the proposals above).
- The last Labs clone (the pan/zoom controller's resize/bind lines in HorizontalTimeView and ZoomMonthView): gesture
  code with view-specific placement; a shared `useZoomSurface` is the backlog's slice for it.
- `.jscpd.json` threshold not ratcheted (a gate change; do it on merge).

## Evidence per step

Unit tests (web 950), `pnpm --silent verify` → `verify: OK`, `pnpm goldens` 18/18 (72 pictures identical), `@visual`
12/12 identical, pixel guard 5/5; targeted e2e where behaviour code moved: resize handles (5 scenarios), settings save
(4), Labs horizontal / zoom month (5). LikeC4 model validates (unchanged).

## Commits (branch `refactor/item-components`, rebased onto main c2c138b)

See `git log main..refactor/item-components`: goldens (3 commits: tooling + baselines, resize handles, skins), then one
commit per step above.
