# Settings in Material 3 Expressive (audit + proposal, not built, not in spec/)

Owner, verbatim: "The material expressive redesign is incomplete because you did not do it in the settings."

## 1. As Is (audited at 390x844, light + dark, local TEST_MODE build of branch design/settings-expressive)
Settings is the only part of the app still in the pre-E look: flat rows on the page colour, a plain back arrow, a regular-weight
title, text-colour section labels, native selects, text-only action buttons. Theme, Error log and Templates already use rounded
28px containers, so settings is also inconsistent with itself.
Code: `components/settings/SettingsShell.vue` (bar, h1 title-large, h2 title-small), `SettingRow.vue` (row, no container),
`RowSelect.vue` (native `<select>` + chevron), `SettingsView.vue` (search + group list), `views/settings/*Group.vue`.
Canvas reference: `project/SettingsE.dc.html`, `MonthVertical-Settings.dc.html`, `TopE.dc.html` of
https://claude.ai/artifact/6n8UiFvkKrY7ZwhL3FKLuP ; ADR 0032; spec `ui-expressive`, `header-expressive`, `settings-groups` (Rule "The settings follow Material 3 Expressive").

## 2. Gap list
Severity: H = visibly not E on every screen, M = on several screens, L = single screen / polish.

| # | Screen | Now | E specifies (source) | Sev |
|---|---|---|---|---|
| 1 | All pages: top bar | Plain bar, standard 40px icon button (no container), title 22px regular (`title-large`), no bar size setting honoured | 64px bar; Back is a tonal round 40px icon button; title 28/36 bold (canvas SettingsE); Compact/Expressive size rule (ADR 0032) | H |
| 2 | All group pages: grouping | Rows float flat on the page background, only h2 text separates sections | Each section is one rounded 28px container (surface-container) with the section title inside, rows 64px inside (canvas SettingsE, Theme page already does this) | H |
| 3 | All: section headers | h2 `title-small`, primary colour, 20px above, no container | Bold 16/24 primary title inside the section container, 8px below (canvas) | M |
| 4 | Account, Calendars, Reminders, Task lists, Error log, Templates: buttons | "Sign out", "Sign out everywhere", "Back up now", "Restore from backup", "Reset" are bare text buttons that look like labels; "Download", "Add category" are tonal | Every row action is a tonal button, full round 40px; paired actions (Back up now + Restore) are a connected button group with 2px gap and 6px inner corners (canvas SettingsE comment) | H |
| 5 | Appearance, Views, Focus, Task lists, Theme: choice rows | Standard M3 outlined segmented button (1px outline, check mark) right-aligned under the label; labels wrap or overflow | Connected button group (ADR 0032; ui-expressive). Overflow bugs today: Task lists "Finished list without a date" (check mark pushes label out), Theme "Icon set" (Outlined/Rounded/Sharp break into one letter per line), "Header + colours" wraps | H (the overflows are bugs) |
| 6 | Appearance, Views: selects (Language, View switcher, Default view, ...) | Native `<select>`, value as primary-coloured text + chevron, no field, no menu | Outlined field with floating label, 56px, 12px corners; opens an M3 menu card (12px, surface-container-high, 48px options, selected = secondary-container + check) (canvas MonthVertical-Settings). `m3/Select.vue` + `Menu.vue` exist and dialogs already use them | H |
| 7 | Settings home: group list | 80px icon circles + chevron, rows flat; search is a pill | Group list as one rounded container (or 28px cards) with tonal icon container, 64px items; search is the E search bar (full round, 56px) | M |
| 8 | Settings home: search | Pill field with outline focus ring, results as flat rows | E search bar, results in a rounded container with section path as supporting text | L |
| 9 | Calendar page | Colour dots flat, hex field is a filled text field, "Plan" and "Add reminder" flat | Sections in containers; hex field outlined like the E text field; swatches inside a container | M |
| 10 | Switches | M3 switch, fine, but rows have no container so the switch floats | Same switch, inside container rows with 64px height (canvas); ADR 0032 does not change the switch itself | L |
| 11 | Value rows (Time of the overview "08:00", Theme "Fall", Language) | Value is a bold primary-coloured word at the end, looks like a link | Trailing value in on-surface-variant, chevron for navigation; an editable value opens a menu or the time picker as a tonal button (open point: see Q3) | M |
| 12 | Dialogs/sheets opened from settings (Add category, Restore from backup, What's new, time picker) | Bottom sheet with 28px top corners, title in primary colour small, "Cancel" text + filled "Save"/"Restore" | Sheet/dialog is already E (AdaptiveSheet, one filled primary, text for cancel). Only the title role (primary 14px vs on-surface headline) and the grey scrim differ from `DialogE` canvas | L |
| 13 | Empty pages (Labs, Bedtime, Error log, Templates) | Single row at top, 700px empty page | Container with the row; E empty-state not defined, keep simple | L |
| 14 | Error log | Action buttons render disabled (empty log) in 2 mismatched styles: filled-tonal, outlined x2, text | One tonal group (Share / Copy / Download) + Clear as text, same as gap 4 | M |
| 15 | Theme page | Already containers, but "January 2030" title in the live preview collides with the scene tree, segmented overflow (gap 5) | Preview is a sample; fix text collision only if it is real (not verified in the app header) | L |
| 16 | Surface tones | Page = `surface`, no `surface-container` anywhere except Theme | Page = surface; sections = surface-container; row actions tonal on that (canvas: #130D0A page, #211713 section, #503528 tonal) | H (follows from 2) |
| 17 | Motion | No enter/exit or press feedback beyond default; flash highlight on search jump | E uses the app's existing motion tokens for press and navigation; no new motion invented | L |
| 18 | Scene/header | No scene (correct: canvas SettingsE has none) | Keep: no scene in Settings | none |

Not capturable in headless: the native select popup (gap 6); the time picker did not open from my script (row has no testid), judged from the code that it is the E picker already (spec scenario "A time is chosen with the time picker").

## 3. To Be and proposed scenarios (draft, NOT in spec/)
Suggested file `spec/features/app/settings-expressive.feature`, `@id settings-expressive`. Extends the existing Rule
"The settings follow Material 3 Expressive". Steps marked (new) need entries in `e2e/STEPS.md`.

```gherkin
Feature: Settings in Material 3 Expressive
  @id settings-expressive

  Rule: Settings has the same bars and containers as the rest of the app

    Scenario: The settings bar is an expressive top bar
      Given I am on a phone
      When I open the settings
      Then the title "Settings" is shown bold at 28 px in a 64 px bar
      And the Back button is a tonal round icon button
      And the settings bar shows no scene

    Scenario: Rows of a group sit in rounded containers
      When I open the settings
      And I open the settings group "Views"
      Then the section "Views in the switcher" is one rounded container
      And its rows are 64 px high
      And the section "General" is a second container

    Scenario: The group list on the settings home is a container
      When I open the settings
      Then the groups "Calendars", "Views", "Task lists", "Reminders", "Appearance & layout", "Focus & calm", "Labs" and "Account & app" are items of one rounded container

  Rule: Every action in Settings follows the one action vocabulary

    Scenario: Row actions are tonal buttons
      Given I am signed in as "johannes@example.com"
      When I open the settings
      And I open the settings group "Account & app"
      Then "Sign out" and "Sign out everywhere" are tonal buttons
      And no button of the settings screen is filled

    Scenario: Back up and Restore are a connected button group
      Given backups to Google Drive are on and the last backup was on 7 Nov 2026
      When I open the settings
      And I open the settings group "Account & app"
      Then "Back up now" and "Restore from backup" are one connected button group

    Scenario: A choice of few options is a connected button group
      When I open the settings
      And I open the settings group "Appearance & layout"
      Then "Top bar size" offers "Automatic", "Expressive" and "Compact" as a connected button group
      And "Automatic" is selected

    Scenario: No option label is cut or broken into letters
      Given I am on a phone
      When I open the settings
      And I open the settings group "Task lists"
      Then every option of "Finished list without a date" shows its full label on one line or on whole words

    Scenario: The icon sets of the theme fit on a phone
      Given I am on a phone
      When I open the settings
      And I open the setting "Theme"
      Then the options "Outlined", "Rounded" and "Sharp" of "Icon set" show their full labels

  Rule: Menus and fields are the expressive ones

    Scenario: A select is an outlined field with a menu
      When I open the settings
      And I open the settings group "Views"
      Then "Default view" is an outlined field showing "Month"
      When I open the field "Default view"
      Then a menu lists "Year", "Month", "Week", "Day" and marks "Month" as chosen

    Scenario: Choosing in the menu closes it and saves
      When I open the settings
      And I open the settings group "Views"
      And I open the field "Default view"
      And I choose "Week" in the menu
      Then the menu is closed
      And "Default view" shows "Week"

    Scenario: The settings search is the expressive search bar
      When I open the settings
      And I type "theme" into the settings search
      Then the search bar is full round and 56 px high
      And the results "Theme" under "Appearance & layout" and "Backup to Google Drive" under "Account & app" are shown

  Rule: Settings looks the same in light and dark

    Scenario: Section containers use the container tone in both modes
      When I open the settings
      And I open the settings group "Reminders"
      Then the section containers are one tone above the page in light and in dark mode

    Scenario: Settings follow the bar size of the app
      Given the top bar size is "Compact"
      When I open the settings
      Then the settings bar is a compact one-row bar
```
@visual scenarios (rebaselined, phone 375x812, light+dark): home, "Views", "Account & app", "Appearance & layout", "Theme".

## 4. Decisions (owner approved the mockup, 2026-11-09)
1. Containers: every section is a rounded 32 px (extra-large token) container on phones; wider screens keep a centred column of at most 640 px.
2. Selects: every native select of the settings pages is an outlined field plus M3 menu (`m3/MenuField.vue`); dialog/sheet selects (`m3/Select.vue`: sharing, calendar plan, task list form) stay native in this pass.
3. Value rows: a value that opens a page is grey + chevron (Theme); a value edited in place is a tonal button (times).
4. Choice rows: up to 4 short options are a connected group (`SegmentedButton connected`), stacked when they do not fit one line; more options or long labels are a field with a menu.
5. Home: 40 px tonal icons in one container. 6. The settings bar follows Top bar size (64 / 56 px). 7. Phone first.
Built: spec/features/app/settings-expressive.feature, spec/features/google/drive-backup-settings.feature, steps in e2e/STEPS.md.

## 5. Screenshots
`shots/` next to this file, naming `<nn>-<screen>-<light|dark>.png`; all 390x844 @2x.
