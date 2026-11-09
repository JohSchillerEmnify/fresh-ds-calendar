/** The settings catalogue (features settings-groups, settings-search); search is normalized substring matching, as the spec asks for no typo tolerance. */
import { LABS_VIEWS } from '@/features/labs';
import { t, type MessageKey } from '@/i18n';

/** The groups of the settings home, in their order. */
export const GROUP_IDS = ['calendars', 'views', 'tasklists', 'reminders', 'appearance', 'focus', 'labs', 'account'] as const;
export type GroupId = (typeof GROUP_IDS)[number];

/** Sub-pages of a group (`/settings/<group>/<page>`). */
type SubPage = 'bedtime' | 'tasks-calendar';

/** One setting: where it lives and the words that find it. */
export interface SettingEntry {
  /** Stable id: the row's `data-setting-id` and the `focus` query of the group page. */
  id: string;
  group: GroupId;
  /** Section header inside the group page (`settingsNav.sub.<sub>`). */
  sub?: string;
  /** A page inside the group that holds the row (Bedtime, Task lists calendar). */
  page?: SubPage;
  label: MessageKey;
  hint?: MessageKey;
  /** Comma-separated extra words, in the app's language. */
  synonyms?: MessageKey;
  /** The row only shows while this setting is on (see `isOn` of {@link resolveTarget}); otherwise it leads there. */
  parent?: string;
  /** A Labs feature: hidden while Labs is off, then the result leads to the Labs switch. */
  labs?: boolean;
}

const e = (group: GroupId, sub: string | undefined, id: string, label: MessageKey, more: Partial<SettingEntry> = {}): SettingEntry => ({ id, group, sub, label, ...more });

/** Every setting in its new place (docs/settings-tree.md). */
export const SETTINGS: readonly SettingEntry[] = [
  e('calendars', undefined, 'tasksCalendar', 'settingsNav.labels.tasksCalendar', { hint: 'settingsNav.labels.tasksCalendarHint' }),
  e('calendars', 'tasksCalendar', 'tasksCalendarVisible', 'settings.calendar.tasksCalendar.label', { hint: 'settings.calendar.tasksCalendar.hint', page: 'tasks-calendar' }),

  e('views', 'general', 'defaultView', 'settings.calendar.defaultView', { synonyms: 'settingsNav.synonyms.defaultView' }),
  e('views', 'general', 'minEventLength', 'settings.calendar.minEventLength.label', { hint: 'settings.calendar.minEventLength.hint', synonyms: 'settingsNav.synonyms.minEventLength' }),
  e('views', 'month', 'monthScroll', 'settings.calendar.monthScroll.label'),
  e('views', 'weekDay', 'daySideBySide', 'settingsNav.labels.sideBySideDay', { hint: 'settings.calendar.sideBySide.hint' }),
  e('views', 'weekDay', 'weekSideBySide', 'settingsNav.labels.sideBySideWeek', { hint: 'settings.calendar.sideBySide.hint' }),
  e('views', 'approaching', 'approachingCard', 'settings.calendar.approachingCard.label', { hint: 'settings.calendar.approachingCard.hint', synonyms: 'settingsNav.synonyms.approachingCard' }),
  e('views', 'approaching', 'approachTimeLeft', 'settings.calendar.approachTimeLeft.label', { hint: 'settings.calendar.approachTimeLeft.hint', parent: 'approachingCard' }),
  e('views', 'approaching', 'approachBar', 'settings.calendar.approachBar.label', { hint: 'settings.calendar.approachBar.hint', parent: 'approachingCard' }),
  e('views', 'approaching', 'approachWindow', 'settings.calendar.approachWindow.label', { parent: 'approachBar' }),

  e('tasklists', 'categories', 'taskCategories', 'settings.tasklists.taskCategories.label', { hint: 'settings.tasklists.taskCategories.hint', synonyms: 'settingsNav.synonyms.taskCategories' }),
  e('tasklists', 'behaviour', 'taskOpen', 'settings.tasklists.taskOpen.label'),
  e('tasklists', 'behaviour', 'carriedFrom', 'settings.tasklists.carriedFrom.label', { hint: 'settings.tasklists.carriedFrom.hint' }),
  e('tasklists', 'behaviour', 'undatedDone', 'settings.tasklists.undatedDone.label'),
  e('tasklists', undefined, 'templates', 'tasks.templates.page', { hint: 'tasks.templates.pageHint' }),

  e('reminders', 'where', 'push', 'settingsNav.labels.push', { hint: 'settingsNav.labels.pushHint', synonyms: 'settingsNav.synonyms.push' }),
  e('reminders', 'appointments', 'notifyEvents', 'settings.notifications.events.label', { hint: 'settingsNav.labels.notifyEventsHint', synonyms: 'settingsNav.synonyms.notifyEvents' }),
  e('reminders', 'tasklists', 'notifyTasklists', 'settings.notifications.tasklists', { hint: 'settingsNav.labels.notifyTasklistsHint' }),
  e('reminders', 'tasklists', 'tasklistDefaults', 'settings.reminders.tasklists.default'),
  e('reminders', 'appointments', 'morning', 'settings.notifications.morning.label', { hint: 'settings.notifications.morning.hint', synonyms: 'settingsNav.synonyms.morning' }),
  e('reminders', 'appointments', 'morningTime', 'settings.notifications.morning.time', { parent: 'morning' }),

  e('appearance', undefined, 'theme', 'settings.theme.label', { hint: 'settings.theme.hint', synonyms: 'settingsNav.synonyms.theme' }),
  e('appearance', undefined, 'language', 'settings.language.label', { synonyms: 'settingsNav.synonyms.language' }),
  e('appearance', 'navigation', 'navPhone', 'settingsNav.labels.navPhone', { hint: 'settings.navPosition.hint' }),
  e('appearance', 'navigation', 'navDesktop', 'settingsNav.labels.navDesktop', { hint: 'settings.navPosition.hint' }),
  e('appearance', 'bars', 'topBarSize', 'settings.calendar.topBarSize.label', { hint: 'settings.calendar.topBarSize.hint' }),
  e('appearance', 'bars', 'bottomBarSize', 'settings.calendar.bottomBarSize.label', { hint: 'settings.calendar.bottomBarSize.hint' }),
  e('appearance', 'more', 'leftHanded', 'settings.leftHanded.label', { hint: 'settings.leftHanded.hint', synonyms: 'settingsNav.synonyms.leftHanded' }),
  e('appearance', 'more', 'syncIndicator', 'settingsNav.labels.syncIndicator', { hint: 'settings.calendar.syncIndicator.hint' }),
  e('appearance', 'more', 'versionCorner', 'settings.account.versionCorner.label'),
  e('appearance', undefined, 'sunflowers', 'settings.sunflowers.label', { hint: 'settings.sunflowers.hint', parent: 'theme' }),

  e('focus', undefined, 'calmMode', 'settings.motivation.calmMode.label', { hint: 'settings.motivation.calmMode.hint', synonyms: 'settingsNav.synonyms.calmMode' }),
  e('focus', 'motion', 'animations', 'settings.motion.animations', { synonyms: 'settingsNav.synonyms.animations' }),
  e('focus', 'motion', 'ignoreSystemMotion', 'settings.motion.ignoreSystem.label', { hint: 'settings.motion.ignoreSystem.hint', parent: 'animations' }),
  e('focus', 'motion', 'sounds', 'settings.motion.sounds', { synonyms: 'settingsNav.synonyms.sounds' }),
  e('focus', 'motivation', 'streak', 'settings.motivation.streak.label', { synonyms: 'settingsNav.synonyms.streak' }),
  e('focus', 'motivation', 'supportCat', 'settings.motivation.supportCat'),
  e('focus', undefined, 'bedtime', 'settings.sections.bedtime', { hint: 'settingsNav.labels.bedtimeHint' }),
  e('focus', 'bedtime', 'bedtimeOn', 'bedtime.settings.on.label', { hint: 'bedtime.settings.on.hint', page: 'bedtime' }),
  e('focus', 'bedtime', 'bedtimeMode', 'bedtime.settings.mode.label', { page: 'bedtime', parent: 'bedtimeOn' }),
  e('focus', 'bedtime', 'bedtimeTime', 'bedtime.settings.bedtime', { page: 'bedtime', parent: 'bedtimeOn' }),
  e('focus', 'bedtime', 'wakeTime', 'bedtime.settings.wake', { page: 'bedtime', parent: 'bedtimeOn' }),
  e('focus', 'bedtime', 'weekend', 'bedtime.settings.weekend.label', { hint: 'bedtime.settings.weekend.hint', page: 'bedtime', parent: 'bedtimeOn' }),
  e('focus', 'bedtime', 'sleep', 'bedtime.settings.sleep.label', { page: 'bedtime', parent: 'bedtimeMode' }),
  e('focus', 'bedtime', 'lead', 'bedtime.settings.lead.label', { page: 'bedtime', parent: 'bedtimeMode' }),
  e('focus', 'bedtime', 'bedtimeReminder', 'settingsNav.labels.bedtimeReminder', { page: 'bedtime', parent: 'bedtimeOn', synonyms: 'settingsNav.synonyms.bedtimeReminder' }),

  e('labs', undefined, 'labs', 'settingsNav.labels.showLabs', { hint: 'settingsNav.labels.showLabsHint', synonyms: 'settingsNav.synonyms.labs' }),
  ...LABS_VIEWS.map((v) => e('labs', 'views', `labsView-${v.id}`, v.labelKey, { labs: true })),
  e('labs', 'more', 'weekTwoRow', 'settings.labs.weekTwoRow.label', { hint: 'settings.labs.weekTwoRow.hint', labs: true }),
  e('labs', 'more', 'weekTwoRowSplit', 'settings.labs.weekTwoRow.split', { parent: 'weekTwoRow', labs: true }),
  e('labs', 'more', 'handwriting', 'ink.settings.label', { hint: 'ink.settings.hint', labs: true }),
  e('labs', 'more', 'ownThemes', 'settings.ownThemes.label', { hint: 'settings.ownThemes.hint', labs: true }),

  e('account', 'account', 'signOutAll', 'settings.account.signOutAll.label', { hint: 'settings.account.signOutAll.hint' }),
  e('account', undefined, 'backup', 'backup.label', { hint: 'backup.hint', synonyms: 'settingsNav.synonyms.backup' }),
  e('account', 'app', 'whatsNew', 'settings.account.whatsNew.label'),
  e('account', 'app', 'errorLog', 'deviceLog.row.label', { hint: 'deviceLog.row.hint', synonyms: 'settingsNav.synonyms.errorLog' }),
  e('account', 'app', 'version', 'settingsNav.labels.version', { synonyms: 'settingsNav.synonyms.version' }),
];

/** Lower case, no accents, dashes as spaces, single spaces: what both the query and the texts are compared as. */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[-‐–—_]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** A row of the search: a setting or a calendar. */
export interface SearchHit { id: string; group: GroupId; label: string; path: string; page?: SubPage }

/** The texts a search compares against, translated. */
export interface SearchSource { id: string; group: GroupId; page?: SubPage; label: string; path: string; words: string[] }

/** Finds the sources whose label, supporting text or synonyms contain the query (normalized). */
export function searchSettings(query: string, sources: readonly SearchSource[]): SearchHit[] {
  const q = normalize(query);
  if (!q) return [];
  return sources
    .filter((s) => [s.label, ...s.words].some((w) => normalize(w).includes(q)))
    .map(({ id, group, page, label, path }) => ({ id, group, page, label, path }));
}

/** The row a chosen setting leads to: itself, the switch that shows it, or the Labs switch while Labs is off (`isOn(id)`: does `id` show its dependants). */
export function resolveTarget(id: string, isOn: (id: string) => boolean): SettingEntry | undefined {
  const entry = SETTINGS.find((s) => s.id === id);
  if (!entry) return undefined;
  if (entry.labs && !isOn('labs')) return resolveTarget('labs', isOn);
  if (entry.parent && !isOn(entry.parent)) return resolveTarget(entry.parent, isOn) ?? entry;
  return entry;
}

/** The route of a group page (or its sub-page) that scrolls to and highlights `focus`. */
export function settingRoute(entry: Pick<SettingEntry, 'group' | 'page'>, focus?: string) {
  const path = entry.page ? `/settings/${entry.group}/${entry.page}` : `/settings/${entry.group}`;
  return focus ? { path, query: { focus } } : { path };
}

/** "Group" or "Group › Subgroup", translated. */
function pathOf(entry: Pick<SettingEntry, 'group' | 'sub'>): string {
  const group = t(`settingsNav.groups.${entry.group}.title`);
  return entry.sub ? `${group} › ${t(`settingsNav.sub.${entry.sub}` as MessageKey)}` : group;
}

/** Every searchable text in the app's language: the settings, then each calendar by its name. */
export function searchSources(calendars: readonly { id: string; name: string }[]): SearchSource[] {
  const settings = SETTINGS.map((s) => ({
    id: s.id, group: s.group, page: s.page, label: t(s.label), path: pathOf(s),
    words: [s.hint ? t(s.hint) : '', ...(s.synonyms ? t(s.synonyms).split(',') : [])].filter(Boolean),
  }));
  const cals = calendars.map((c) => ({ id: `calendar:${c.id}`, group: 'calendars' as const, label: c.name, path: pathOf({ group: 'calendars' }), words: [] }));
  return [...settings, ...cals];
}
