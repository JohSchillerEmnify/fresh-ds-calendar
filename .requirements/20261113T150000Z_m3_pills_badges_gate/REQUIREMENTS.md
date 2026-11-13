# M3 pills, badges and chips onto kit parts, wider lint gate (issue 48)

## As Is
Hand-styled pills (template picker, Today pill, tray count chip, reminder chips and option chips), hand-made count badges and
`role=button` elements (canvas area header, category grip) exist outside `web/src/components/m3`. The lint gate bans only raw `<button>`.

## To Be
- New kit part `Badge` (6 px dot, 16 px pill with label, error colours: material-web tokens v0.192 `_md-comp-badge`).
- `Chip` gains the `input` variant (span with a named remove cross, `_md-comp-input-chip`) and a `static` flag (same drawing, not a button; used inside another button).
- `Button` and `IconButton` outlined sit on the solid surface; `IconButton` gains `outlined`.
- Today is the kit filled Button (wide) or filled/outlined IconButton (phone); the template pill is a kit tonal Button; the category grip an IconButton; the canvas area header a Pressable.
- Lint gate bans `<input>`, `<textarea>`, `<select>`, `role=button|checkbox|dialog|option` and `@click` on div/span/li/header outside the kit; `eslint.allowlist.mjs` lists the remaining files with a reason and only shrinks (unit test).

## Requirements and acceptance
See `spec/features/app/ui-expressive.feature` (rules on the lint gate and on badges, pills and chips); proven by `web/test/lint-gate.test.ts`,
`web/test/m3-badge-input-chip.test.ts` and the existing Today, reminders, templates, tray and toolbar scenarios.

## Assumptions
- Badge takes the token colour (error red), not the old primary.
- Today filled = primary (kit filled), no longer primary-container; off = kit outlined (primary text) on the surface.
- Not moved: the edge band pill (an indicator with a text label, 32 px, primary) and the tray row's panel/menus (dialog slice).
