/** Pixelarticons variant of every app icon (one chunk: loaded only when this icon set is in use, see `icons.ts`). */
import type { Component } from 'vue';
import MoreHorizP from '~icons/pixelarticons/more-horizontal';
import ContentCopyOutlineP from '~icons/pixelarticons/copy';
import ArchiveOutlineP from '~icons/pixelarticons/archive';
import BookmarkAddP from '~icons/pixelarticons/bookmark';
import AddP from '~icons/pixelarticons/plus';
import ArrowBackP from '~icons/pixelarticons/arrow-left';
import BedtimeP from '~icons/pixelarticons/moon';
import MapOutlineP from '~icons/pixelarticons/map';
import MyLocationP from '~icons/pixelarticons/gps';
import LocationOnP from '~icons/pixelarticons/map-pin';
import SunnyP from '~icons/pixelarticons/sun';
import CalendarMonthP from '~icons/pixelarticons/calendar';
import CalendarViewDayP from '~icons/pixelarticons/calendar-today';
import CalendarViewMonthP from '~icons/pixelarticons/calendar-month';
import CalendarViewWeekP from '~icons/pixelarticons/calendar-week';
import CheckP from '~icons/pixelarticons/check';
import ChevronLeftP from '~icons/pixelarticons/chevron-left';
import ChevronRightP from '~icons/pixelarticons/chevron-right';
import MenuP from '~icons/pixelarticons/menu';
import CloseP from '~icons/pixelarticons/close';
import CloudOffP from '~icons/pixelarticons/cellular-signal-off';
import CloudUploadP from '~icons/pixelarticons/upload';
import DeleteOutlineP from '~icons/pixelarticons/trash';
import DownloadP from '~icons/pixelarticons/download';
import DrawP from '~icons/pixelarticons/brush';
import KeyboardP from '~icons/pixelarticons/keyboard';
import UndoP from '~icons/pixelarticons/undo';
import InkEraserP from '~icons/pixelarticons/eraser';
import EditOutlineP from '~icons/pixelarticons/edit';
import ExpandMoreP from '~icons/pixelarticons/chevron-down';
import FilterListP from '~icons/pixelarticons/filter';
import IosShareP from '~icons/pixelarticons/share';
import DragIndicatorP from '~icons/pixelarticons/more-vertical';
import KeyboardArrowUpP from '~icons/pixelarticons/chevron-up';
import ChecklistP from '~icons/pixelarticons/checklist';
import SwapVertP from '~icons/pixelarticons/arrows-vertical';
import SwapHorizP from '~icons/pixelarticons/arrows-horizontal';
import ScheduleP from '~icons/pixelarticons/clock';
import TimelineP from '~icons/pixelarticons/timeline';
import ZoomInP from '~icons/pixelarticons/zoom-in';
import ViewColumnP from '~icons/pixelarticons/layout-columns';
import ViewAgendaP from '~icons/pixelarticons/layout-rows';
import UnfoldLessP from '~icons/pixelarticons/collapse';
import UnfoldMoreP from '~icons/pixelarticons/expand';
import SettingsOutlineP from '~icons/pixelarticons/gear';
import SyncP from '~icons/pixelarticons/sync';
import SyncProblemP from '~icons/pixelarticons/warning-diamond';
import SearchP from '~icons/pixelarticons/search';
import NotificationsOutlineP from '~icons/pixelarticons/bell';
import ScienceOutlineP from '~icons/pixelarticons/test-tube';
import AccountCircleOutlineP from '~icons/pixelarticons/avatar';
import WidgetsOutlineP from '~icons/pixelarticons/grid';
import SelfImprovementP from '~icons/pixelarticons/sparkles';

export default {
  MoreHoriz: MoreHorizP,
  ContentCopyOutline: ContentCopyOutlineP,
  ArchiveOutline: ArchiveOutlineP,
  BookmarkAdd: BookmarkAddP,
  Add: AddP,
  ArrowBack: ArrowBackP,
  Bedtime: BedtimeP,
  LocationOn: LocationOnP,
  MapOutline: MapOutlineP,
  MyLocation: MyLocationP,
  Sunny: SunnyP,
  CalendarMonth: CalendarMonthP,
  CalendarViewDay: CalendarViewDayP,
  CalendarViewMonth: CalendarViewMonthP,
  CalendarViewWeek: CalendarViewWeekP,
  Check: CheckP,
  ChevronLeft: ChevronLeftP,
  ChevronRight: ChevronRightP,
  Menu: MenuP,
  Close: CloseP,
  CloudUpload: CloudUploadP,
  CloudOff: CloudOffP,
  DeleteOutline: DeleteOutlineP,
  Download: DownloadP,
  Draw: DrawP,
  Keyboard: KeyboardP,
  Undo: UndoP,
  InkEraser: InkEraserP,
  EditOutline: EditOutlineP,
  Today: CalendarViewDayP,
  ExpandMore: ExpandMoreP,
  FilterList: FilterListP,
  IosShare: IosShareP,
  KeyboardArrowDown: ExpandMoreP,
  DragIndicator: DragIndicatorP,
  KeyboardArrowUp: KeyboardArrowUpP,
  Checklist: ChecklistP,
  SwapVert: SwapVertP,
  SwapHoriz: SwapHorizP,
  Schedule: ScheduleP,
  Timeline: TimelineP,
  ZoomIn: ZoomInP,
  ViewColumn: ViewColumnP,
  ViewAgenda: ViewAgendaP,
  UnfoldLess: UnfoldLessP,
  UnfoldMore: UnfoldMoreP,
  SettingsOutline: SettingsOutlineP,
  Sync: SyncP,
  SyncProblem: SyncProblemP,
  Search: SearchP,
  PaletteOutline: DrawP,
  NotificationsOutline: NotificationsOutlineP,
  ScienceOutline: ScienceOutlineP,
  AccountCircleOutline: AccountCircleOutlineP,
  WidgetsOutline: WidgetsOutlineP,
  SelfImprovement: SelfImprovementP,
} as Record<string, Component>;
