# Architecture

## Migrated

Every section of the former prose was ported to the novibe layout and removed here; implementation detail was dropped
(the code is the source):

- §1–4 (overview, server components, task lists in Google, sync, Google rate limits): LikeC4 model
  (`docs/architecture/`: views `index`, `server`, `web`, `prod`, `loadRange`, `rateLimitedRead`, `firstTaskList`),
  ADRs 0005–0007, the encoding contract in `API.md` "Storage in Google", and `spec/features/google/sync.feature`.
- §6 PWA, §7 testing, sign-in, all calendars, diagnostics, §8–10: model (`signIn`, `server`, `web`), ADRs 0008–0009,
  `app/pwa.feature`, `google/signin.feature`, `events/calendars.feature`; env in `docs/DEPLOYMENT.md`, tooling in
  `CONTRIBUTING.md`, test setup in `e2e/README.md`.
- Backups, Shared lists: model (`backupAfterChange`, `restoreAtSignIn`, `shareList`), ADRs 0010–0011, the bundle
  contract in `API.md` "Backups", `google/drive-backup.feature`, `task-lists/shared-lists.feature`.
- §5 Web app core (router, focus date, time grid, zoom, i18n, mobile-first UX, Material 3, settings, categories and
  filters, §5a resource budgets): model (`web`, `switchView`, `settingFailsToSave`), ADRs 0020–0021, `views/navigation`,
  `views/mobile`, `views/timeline`, `events/events-display`, `events/events-crud`, `app/settings`, `app/language`,
  `app/performance`, `themes/theme`, `task-lists/categories` features.
- §5b–5c and the owner sections after them (ADHD features, open tasks tray, motion and rewards, drag and drop, back
  closes overlays, delete with undo, snackbars, bedtime, new version notice, version numbers, release notes, view
  switcher position, left-handed mode): model (`web`, `deleteWithUndo`, `bedtimeNight`, `appUpdate`), versioning and
  release notes in `docs/DEPLOYMENT.md`, `API.md` "`GET /api/release-notes`", `motivation/*`, `events/dnd`,
  `task-lists/open-tasks`, `app/pwa`, `app/release-notes`, `views/nav-position`, `app/left-handed` features.
- Labs (clock, approaching track, zoom month, horizontal view, timeline, strip): model (`web`, `chooseLabsViews`),
  `labs/*` features, `API.md` "Prefs".
- Themes, theme menu, fine-tuning, Seasons & holidays, scenes and the support cat, rounded fields, theme engine and AI
  themes: model (`web`, `server`, `chooseThemeSeasonal`, `importOwnTheme`), ADR 0016, `API.md` "Theme preference" and
  "Imported themes", `themes/*` and `motivation/support-cat` features.
- Task lists UI (undated lists, Tasks view, Archive, Canvas, categories switch, Tasks filter, untitled lists, tapping and
  the grown card, the one "new" dialog): model (`web`, `server`, `tapTaskList`, `moveNote`, `finishList`), ADRs
  0017–0019, `task-lists/*` features.
- Android app and widget, own-events editing, birthdays, reminders and notifications, security hardening: model
  (`androidApp`, `widget`, `chooseServer`, `signInFromApp`, `widgetWeekRefresh`, `remindersRing`, `prod`), ADRs
  0012–0015, `API.md` "Web Push", "Birthdays", "Sign-in", "`GET /app.apk`", `docs/DEPLOYMENT.md` "Android app" and
  "Public server (VPS)", `events/events-readonly`, `events/birthdays`, `events/reminders`, `google/signin`, `app/pwa`,
  `app/android-app`, `app/phone-widget` features.

The architecture now lives in docs/architecture (LikeC4) and docs/adrs; behaviour in spec/features.
