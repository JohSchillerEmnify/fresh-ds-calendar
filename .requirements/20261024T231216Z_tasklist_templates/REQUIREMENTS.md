# Task list templates

Owner (2026-10-25): "new feature. Task templates. One may create from a task a template. This applies to already done
tasks as well as just when creating a task. You may make this task a template if you have something where you need to
do the same thing many times. And you want an easy way to add that, basically, if you get my meaning. You can then
choose to create tasks from template, which would give you all the items in that task template, and then you can set
time and stuff and, you know, use it that way." Addition: "And then we need some way of managing those templates."

Owner answers (2026-10-25, on a design canvas mockup): Q1 (a) app server per person; Q2 (a) name, items unticked,
estimate, category; Q3 (c) KEEP the Archive's one-off "Use as template" as it is and add "Save as template" next to it
(`tasks-archive.feature:40` unchanged); Q4 (a) Settings › Task lists › Templates, a row in the Task lists card that
opens a sub page, linked from the picker's "Manage templates". UI as decided on the canvas: see To Be.
Owner addition (2026-10-25): the Archive's one-off "Use as template" is renamed "Copy" (de "Kopieren", coldmirror its
own short word) with unchanged behaviour, so "template" only means the saved templates (`tasks-archive.feature`).
Owner addition (canvas comment): the Templates sub page has a "New template" button on top of the list (and in the
empty state) that opens the same template sheet empty, titled "New template"; name required.

Status: SPEC ONLY, scenarios updated to the answers; the owner looks once more before the build. Scenarios:
`spec/features/task-lists/tasklist-templates.feature`, steps in `e2e/STEPS.md` "Task list templates".

## As Is

- Creating: the FAB `create-button` (`web/src/components/shell/CreateFab.vue:22`) or a tap on an empty slot
  (`TimeGrid.vue:176`) opens the new dialog (`extensions/create.ts`), switch Event | Task list | Birthday
  (`NewKindSwitch.vue`). The task list form is `web/src/features/tasklists/TaskListDialog.vue`: title, date, time,
  No date, estimate, door switch (plugin), category (pref `taskCategories`), sharing (edit), reminders, items textarea
  and repeat (create only). `POST /api/tasklists`.
- A task list is one Google event in the person's hidden tasks calendar (ADR 0006), items etc. in
  `extendedProperties.private` (`server/src/services/taskCodec.ts`). Model: `server/src/api/types.ts:69-102`.
- Actions on a list: footer of `features/tasklists/TaskListView.vue:313-319` (Add item, Edit, Delete/Leave), used by
  the list sheet, the tray and the Tasks view tabs.
- "Use as template" exists only in the Archive (`TasksView.vue:60-67,99`, `archive.ts:32-35`): a one-shot copy as an
  undated open list (same title, category, tags, all items open). Nothing is kept as a template.
- App data that is not an event lives on the app server as per-person JSON (ADR 0005): `users/<sub>/prefs.json`,
  `themes/<id>.json`, `canvas.json`, … backed up to the person's Drive appDataFolder (ADR 0010), cached read-only in
  IndexedDB (ADR 0023). Categories are server-wide (`settings.json`).
- No backlog scenario mentions templates.

## To Be

- A task list can be saved as a template from its footer: a tonal pill "Save as template" after "+ Add item" and before
  Edit/Delete, wherever the footer shows: list sheet, tray, Tasks view Open and Archive (so also finished lists). In
  the Archive it sits next to the existing one-off copy, which stays and is renamed "Copy". A small dialog shows the name
  field (prefilled with the list's title), a preview of the items and Cancel/Save.
- The new task list form has a switch row "Also save as template" right above Cancel/Save (create only): saving the
  list also saves it as a template named by its title.
- The new task list form has a "From template ▾" pill next to its "New task list" heading. A tap grows the pill in
  place into a rounded menu (container transform) listing the templates, each with a details line
  ("2 items · ~45 min · Home"), then a divider and "Manage templates". Picking one fills title, items, estimate and
  category and the pill then shows the template's name ("Clean bathroom ▾"); date and time stay as the dialog was
  opened (focused day or tapped slot); the rest (repeat, reminders, door…) is set as for any new list. With no
  templates the menu says how to make one.
- Settings › Task lists › Templates: a row in the existing Task lists card (categories, carried-over, finished-list,
  tap options) opens a Templates sub page: all templates by name, empty state, open one to change name, items (one per
  line: add, remove, reorder, retitle), estimate and category; delete with undo.
- A template keeps name, item titles in order (never ticked), estimate, category. Not date, time, repeat, reminders,
  tags/door, sharing, canvas place, ticks.
- Templates are stored per person on the app server (`users/<sub>/templates.json`, `/api/templates`), so they
  follow the person to every device and never appear in Google or the calendar.
- Changing or deleting a template never changes lists made from it.

## Requirements

1. Save any task list (open or finished) as a template, with a name (prefilled with the title, required, unique).
2. While creating a task list, optionally save it as a template too (needs a title).
3. Start a new task list from a template: form prefilled with items (unticked), title, estimate, category; date/time
   from where the dialog was opened; everything editable before saving; the template is unchanged.
4. A template can be used any number of times.
5. Template picker: the "From template" pill grows into a menu of the templates by name with a details line (items,
   estimate, category), empty state, a divider and "Manage templates"; after a pick the pill shows the name.
6. Management in Settings: list, empty state, rename, change items/estimate/category, delete with undo, cancel.
7. Templates follow the person across devices; they are not events.
8. Changes to or deletion of a template leave existing lists alone.

## Acceptance Criteria

1. "Save an open task list as a template" (footer order, items preview), "Save a finished task list from the Archive
   as a template, next to its one-off copy", "A template
   keeps the estimate and the category but not the date, time or ticks", "The template can be given its own name",
   "A template needs a name when it is saved from a list", "Two templates cannot have the same name".
2. "A new task list can be saved as a template while it is created", "A new titleless list cannot also be saved as a
   template".
3. "Create a task list from a template and set its time", "A template fills the estimate and the category",
   "Starting from a template keeps the time of the tapped slot", "The list made from a template can be changed before
   it is saved and the template stays as it was".
4. "The same template can be used again and again".
5. "The template pill grows into a menu of the templates with their items, estimate and category", "Without templates the picker says how
   to make one", "The template picker leads to the template management".
6. "The settings list every template", "Without templates the settings page says how to make one", "Rename a
   template", "Change a template's items: add, remove, reorder and retitle", "Change a template's estimate and
   category", "A template needs a name", "Cancelling the template dialog changes nothing", "Delete a template",
   "Undoing a template deletion brings it back".
7. "A template saved on one device is there on another", "Templates never show in the calendar or in Google".
8. "Changing a template leaves lists already made from it alone", "Deleting a template leaves lists already made from
   it alone".

## Testing Plan

- Server unit (vitest): template store (create, list sorted, update, delete, unique names case-insensitive, per person
  isolation, items without done state), API validation (name required, item limits like task lists).
- Web unit: form prefill from a template (date/time untouched), template from a list (ticks dropped, fields kept).
- e2e: the scenarios above, targeted with `--grep`, mobile and desktop.
- Visual: picker, templates page (with and without templates), template dialog at phone size, looked at.

## Implementation Plan (after the owner's answers)

1. Server: `templateStore` (`users/<sub>/templates.json`, atomic JSON), `/api/templates` CRUD, backup registration,
   API.md, LikeC4 (`calendar.server.templateStore` store + `templatesApi`), ADR "templates live on the app server".
2. Web: `templates` store (+ last-known cache), API client.
3. Save as template: footer pill + name dialog with items preview; in the Archive next to "Copy".
4. Task list form: "From template" picker, "Also save as template" switch.
5. Settings → Task lists → Templates page, template dialog, delete with undo.
6. i18n en/de (fun dialects fall back), e2e steps, verify, targeted e2e, visual.
PR boundary: one PR (the pieces are not useful alone).

## Open choices (owner) — answered 2026-10-25: Q1 (a), Q2 (a), Q3 (c), Q4 (a)

- Q1 Where templates are stored. Recommended: app server, per person (like prefs, own themes, canvas areas; ADR 0005,
  backed up to Drive by ADR 0010). Alternatives: a private Google event in the hidden tasks calendar
  (`kind=template`, anchored like undated lists): survives without the server but needs filtering everywhere a list is
  read and shows in Google if the tasks calendar is made visible; or device only (IndexedDB): does not follow the person.
- Q2 What a template keeps. Recommended: name, items, estimate, category. Alternatives: also tags (incl. the door
  switch) and reminders; or only name and items.
- Q3 The Archive's existing "Use as template" (one-shot undated copy). Recommended: replace it with "Save as
  template" (the footer action), so "template" means one thing; reusing is then "From template" in the new dialog.
  Alternatives: keep it, renamed "Copy as new list"; or keep it as is next to "Save as template".
- Q4 Where templates are managed. Recommended: Settings → Task lists → Templates, reachable also from the picker's
  "Manage templates". Alternatives: manage only inside the picker (edit/delete per row); or a "Templates" tab in the
  Tasks view next to Open and Archive.

## Assumptions (stated, not asked)

- A1 Template names are unique (case-insensitive); saving under a taken name shows an error rather than replacing.
- A2 The picker and the settings page sort by name.
- A3 Saving the same list again as a template under a new name makes a second template; there is no link back from a
  list to its template.
- A4 A template whose category was deleted fills "No category". With task categories off, the category is kept in
  the template but not shown or filled.
- A5 "From template" over a form that already has text replaces title, items, estimate and category without asking.
- A6 Shared lists can be saved as templates too (the template is the saver's own).
- A7 Items edited as lines in the template dialog, like the task list create form (covers add, remove, reorder,
  retitle); no drag handles in a first version.
