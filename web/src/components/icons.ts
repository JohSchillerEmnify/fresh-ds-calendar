/**
 * The app's icons (feature theme-menu): each is a component that draws the variant of the current icon set (Material
 * Symbols outlined, rounded or sharp, Solar, Phosphor or Pixelarticons). Each set is its own chunk (`icons.<set>.ts`,
 * inline SVG by `unplugin-icons`) that is fetched only when the set is in use, so the first load carries one set; the
 * service worker precaches all of them for offline use. `loadIconSet` must be awaited before the first mount; until a switched-to set arrives, the loaded set draws.
 */
import { defineComponent, h, shallowRef, watch, type Component } from 'vue';
import { iconSet, type IconSet } from '@/theme/iconSet';

type SetIcons = Record<string, Component>;

const loaders: Record<IconSet, () => Promise<{ default: SetIcons }>> = {
  outlined: () => import('./icons.outlined'),
  rounded: () => import('./icons.rounded'),
  sharp: () => import('./icons.sharp'),
  solar: () => import('./icons.solar'),
  phosphor: () => import('./icons.phosphor'),
  pixelart: () => import('./icons.pixelart'),
};
const loaded = shallowRef<Partial<Record<IconSet, SetIcons>>>({});

/** Fetch one icon set's chunk (once) and make the icon components draw it. */
export async function loadIconSet(set: IconSet): Promise<void> {
  if (loaded.value[set]) return;
  const icons = (await loaders[set]()).default;
  loaded.value = { ...loaded.value, [set]: icons };
}

// a set chosen later in the theme menu is fetched on demand
watch(iconSet, (set) => { void loadIconSet(set); });

/** A component that draws `key` of the current set (any loaded set until it arrives); attributes fall through to the SVG. */
function appIcon(name: string, key: string): Component {
  return defineComponent({
    name,
    props: { set: { type: String as () => IconSet, default: undefined } },
    setup: (props) => () => {
      const want = props.set ?? iconSet.value;
      const set = loaded.value[want] ? want : (Object.keys(loaded.value)[0] as IconSet | undefined);
      const icon = set && loaded.value[set]?.[key];
      return icon ? h(icon, { 'data-icon-set': set }) : null;
    },
  });
}

export const IconMoreHoriz = appIcon('IconMoreHoriz', 'MoreHoriz');
export const IconContentCopyOutline = appIcon('IconContentCopyOutline', 'ContentCopyOutline');
export const IconArchiveOutline = appIcon('IconArchiveOutline', 'ArchiveOutline');
export const IconBookmarkAdd = appIcon('IconBookmarkAdd', 'BookmarkAdd');
export const IconAdd = appIcon('IconAdd', 'Add');
export const IconArrowBack = appIcon('IconArrowBack', 'ArrowBack');
export const IconCalendarMonth = appIcon('IconCalendarMonth', 'CalendarMonth');
export const IconCalendarViewDay = appIcon('IconCalendarViewDay', 'CalendarViewDay');
export const IconCalendarViewMonth = appIcon('IconCalendarViewMonth', 'CalendarViewMonth');
export const IconCalendarViewWeek = appIcon('IconCalendarViewWeek', 'CalendarViewWeek');
export const IconCheck = appIcon('IconCheck', 'Check');
export const IconChevronLeft = appIcon('IconChevronLeft', 'ChevronLeft');
export const IconChevronRight = appIcon('IconChevronRight', 'ChevronRight');
export const IconMenu = appIcon('IconMenu', 'Menu');
export const IconClose = appIcon('IconClose', 'Close');
export const IconCloudOff = appIcon('IconCloudOff', 'CloudOff');
export const IconDeleteOutline = appIcon('IconDeleteOutline', 'DeleteOutline');
export const IconDownload = appIcon('IconDownload', 'Download');
export const IconDraw = appIcon('IconDraw', 'Draw');
export const IconKeyboard = appIcon('IconKeyboard', 'Keyboard');
export const IconUndo = appIcon('IconUndo', 'Undo');
export const IconInkEraser = appIcon('IconInkEraser', 'InkEraser');
export const IconEditOutline = appIcon('IconEditOutline', 'EditOutline');
export const IconToday = appIcon('IconToday', 'Today');
export const IconExpandMore = appIcon('IconExpandMore', 'ExpandMore');
export const IconFilterList = appIcon('IconFilterList', 'FilterList');
export const IconIosShare = appIcon('IconIosShare', 'IosShare');
export const IconKeyboardArrowDown = appIcon('IconKeyboardArrowDown', 'KeyboardArrowDown');
export const IconDragIndicator = appIcon('IconDragIndicator', 'DragIndicator');
export const IconKeyboardArrowUp = appIcon('IconKeyboardArrowUp', 'KeyboardArrowUp');
export const IconChecklist = appIcon('IconChecklist', 'Checklist');
export const IconSwapVert = appIcon('IconSwapVert', 'SwapVert');
export const IconSwapHoriz = appIcon('IconSwapHoriz', 'SwapHoriz');
export const IconSchedule = appIcon('IconSchedule', 'Schedule');
export const IconTimeline = appIcon('IconTimeline', 'Timeline');
export const IconZoomIn = appIcon('IconZoomIn', 'ZoomIn');
export const IconViewColumn = appIcon('IconViewColumn', 'ViewColumn');
export const IconViewAgenda = appIcon('IconViewAgenda', 'ViewAgenda');
export const IconUnfoldLess = appIcon('IconUnfoldLess', 'UnfoldLess');
export const IconUnfoldMore = appIcon('IconUnfoldMore', 'UnfoldMore');
export const IconSettingsOutline = appIcon('IconSettingsOutline', 'SettingsOutline');
export const IconSync = appIcon('IconSync', 'Sync');
export const IconSyncProblem = appIcon('IconSyncProblem', 'SyncProblem');
export const IconBedtime = appIcon('IconBedtime', 'Bedtime');
export const IconSunny = appIcon('IconSunny', 'Sunny');
/** A map pin (filled in every set: it marks a place on the small map and in the place suggestions). */
export const IconLocationOn = appIcon('IconLocationOn', 'LocationOn');
export const IconMapOutline = appIcon('IconMapOutline', 'MapOutline');
export const IconMyLocation = appIcon('IconMyLocation', 'MyLocation');
export const IconSearch = appIcon('IconSearch', 'Search');
export const IconPaletteOutline = appIcon('IconPaletteOutline', 'PaletteOutline');
export const IconNotificationsOutline = appIcon('IconNotificationsOutline', 'NotificationsOutline');
export const IconScienceOutline = appIcon('IconScienceOutline', 'ScienceOutline');
export const IconAccountCircleOutline = appIcon('IconAccountCircleOutline', 'AccountCircleOutline');
export const IconSelfImprovement = appIcon('IconSelfImprovement', 'SelfImprovement');
