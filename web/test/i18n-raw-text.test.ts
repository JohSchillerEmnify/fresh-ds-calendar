import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'vue/compiler-sfc';
import { describe, expect, it } from 'vitest';
import { rawText, type Node } from '../src/i18n/raw-text';

/**
 * Components already moved to the message catalogue (ARCHITECTURE "i18n", "Moving the remaining strings"). Add a
 * file here when its area is migrated; the check then keeps hard-coded UI text out of its template.
 */
const MIGRATED = [
  'src/views/SettingsView.vue',
  'src/components/m3/NavigationBar.vue',
  'src/components/m3/NavigationRail.vue',
  // calendar area
  'src/views/YearView.vue', 'src/views/MonthView.vue', 'src/views/WeekView.vue', 'src/views/DayView.vue', 'src/views/SignInView.vue',
  'src/components/calendar/TimeGrid.vue', 'src/components/calendar/BasicItem.vue', 'src/components/calendar/ItemView.vue',
  'src/components/shell/AppTopBar.vue', 'src/components/shell/MonthPicker.vue', 'src/components/shell/FilterBar.vue',
  'src/components/shell/CreateFab.vue', 'src/components/shell/NewKindSwitch.vue', 'src/components/shell/ReauthBanner.vue',
  'src/components/shell/SyncErrorBanner.vue', 'src/components/shell/SyncStatus.vue', 'src/components/shell/InstallPrompts.vue',
  'src/components/shell/VersionLabel.vue', 'src/components/m3/ConfirmDialog.vue', 'src/components/m3/Snackbar.vue',
  'src/features/calendar/EventDialog.vue', 'src/features/calendar/NowCard.vue', 'src/features/calendar/NowMarker.vue',
  'src/features/calendar/EventBar.vue', 'src/features/calendar/EventItem.vue', 'src/features/calendar/DropIndicator.vue',
  'src/features/calendar/ResizeHandles.vue',
  'src/features/labs/approach/ApproachBar.vue', 'src/features/labs/clock/ClockView.vue', 'src/features/labs/strip/StripView.vue',
  'src/features/labs/timeline/TimelineView.vue',
  'src/features/tasklists/TasksView.vue',
  'src/features/tasklists/TaskListView.vue',
  'src/features/tasklists/TaskListCard.vue',
  'src/features/tasklists/ExpandedTaskList.vue',
  'src/features/tasklists/TaskListDialog.vue',
  'src/features/tasklists/TaskTray.vue',
  'src/features/tasklists/StrikeLine.vue',
  'src/features/tasklists/TasksCanvas.vue',
  'src/features/tasklists/TasksFilterBar.vue',
  'src/features/tasklists/CanvasNote.vue',
  'src/features/tasklists/CanvasArea.vue',
  'src/features/motivation/PlantCard.vue',
  'src/features/motivation/Plant.vue',
  'src/features/motivation/LeadingWidgets.vue',
  'src/features/motivation/StreakFlame.vue',
  'src/features/motivation/StreakToast.vue',
  'src/features/motivation/SunflowerField.vue',
  'src/features/motivation/SupportCat.vue',
  'src/features/motivation/DragCat.vue',
  'src/views/ThemeView.vue',
  'src/components/settings/ThemeCard.vue',
  'src/components/settings/ThemeImport.vue',
  'src/components/settings/ThemeSample.vue',
  'src/components/settings/SaveThemeDialog.vue',
  'src/components/settings/CategoryDialog.vue',
];
/**
 * Strings that other feature branches added before the i18n slice landed. They move into the catalogue with their area
 * (the per-area migration, ARCHITECTURE "i18n"); delete each entry then. Nothing else may be hard-coded.
 */
const NOT_YET_MIGRATED: Record<string, string[]> = {};
describe('migrated components have no hard-coded UI text', () => {
  it.each(MIGRATED)('%s', (file) => {
    const { descriptor } = parse(readFileSync(resolve(process.cwd(), file), 'utf8'));
    const known = NOT_YET_MIGRATED[file] ?? [];
    expect(rawText(descriptor.template!.ast as unknown as Node).filter((x) => !known.includes(x))).toEqual([]);
  });
});
