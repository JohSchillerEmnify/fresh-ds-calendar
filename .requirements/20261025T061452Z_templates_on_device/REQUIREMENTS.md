# Task list templates kept on the device

Owner rule (2026-10-25, HARD): "Everything should be stored on device and only synced from the server." Templates
shipped (a7e9c5f) without an on-device copy: offline the picker and Settings › Templates said "Templates need a
connection." Owner: "How does that make any kind of sense?" This reverses S1 of
`20261024T231216Z_tasklist_templates` and the matching consequence in ADR 0024.

## As Is

- `templatesStore` holds the templates in memory only; it reads `/api/templates` when the picker, the Templates page,
  the save dialog or the task list form opens.
- The last-known snapshot (ADR 0023, `stores/lastKnown.ts`, IndexedDB `calendar-last-known`) keeps config, settings,
  prefs, calendars, imported themes and seen ranges; not the templates.
- Offline (or before the first read) the picker and the Templates page show "Templates need a connection."

## To Be

- The snapshot also keeps the person's templates (field `templates`, optional so older snapshots still restore).
  On start they are restored with the rest, so the picker and the Templates page show them at once.
- Templates are refreshed with every sync (a sync task `templates`, like settings and calendars), so a fresh snapshot
  always carries them; the existing on-open reads stay (another device may have changed them).
- Sign-out / the sign-in page wipe them with the rest; a save for one person replaces any other's (unchanged code).
- Changing a template offline fails as every other change does (last-known-state: "Changes still need a
  connection"); no queue.
- The "Templates need a connection" reading state and its text are removed. Never read and nothing on the device
  (first start offline): the picker shows only "Manage templates", the Templates page only "New template"; the sync
  banner already says the server is unreachable.

## Requirements

1. R1 The last-known snapshot stores the shown templates (without ones waiting for their undo time) and restores them.
2. R2 Templates are refreshed on every sync; a failed read is a failed sync (banner), like settings.
3. R3 No "Templates need a connection" state.
4. R4 Changes offline fail with the existing error handling; the server keeps the template.

## Acceptance Criteria

- R1: scenarios "Without a connection the template picker lists the templates and fills the form", "Without a
  connection the settings list the templates" (tasklist-templates); "Someone else signing in on this device does not
  get my templates" (last-known-state); unit: save/restore round trip, old snapshot without `templates` restores.
- R2: unit: the sync runs the `templates` task.
- R3: no `tasks.templates.offline` key, no `templates-offline` / `template-picker-offline` test ids.
- R4: scenario "Without a connection a template cannot be changed".

## Testing Plan

Unit (vitest): lastKnown save includes templates, restore applies them (store `loaded`), snapshot without the field;
templates store `restore`. e2e (targeted, mobile + desktop): the four new scenarios plus the existing templates and
last-known-state features.

## Implementation Plan

1. Spec scenarios + STEPS (no new steps needed) → check-steps 0 problems. Commit.
2. Unit tests red → `templatesStore.restore`, snapshot field, sync task, remove offline state → green, `verify`.
3. ADR 0024 consequence, CHANGELOG, old REQUIREMENTS S1 note. Targeted e2e. Commit (one PR with the templates branch).

## Assumptions

- A1 Saving the visible list (pending deletes left out) avoids a deleted template coming back from the device after a
  keepalive delete; an undo saves it again.
- A2 Never-read-and-offline shows no line at all (the sync banner covers it) rather than a misleading empty state.
- A3 Offline save error text stays the app's generic one ("Could not save: Google Calendar is unavailable"), which
  names Google although templates live on the app server — pre-existing wording, reported to the owner, not changed.
