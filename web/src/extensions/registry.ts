/**
 * Extension points of the app shell. Feature modules (event UI, task list UI, motivation, ...) register here
 * from their own entry file; the shell and views never import those features directly. See web/README.md.
 */
import { defineAsyncComponent, markRaw, reactive, shallowReactive, type Component } from 'vue';
import type { CalendarItem } from '@/api/types';
import type { Segment } from '@/lib/items';
import { useUiStore } from '@/stores/ui';

// --- 1. create context (the one "new" dialog: FAB, empty slot) --------------------------------
export interface CreateContext {
  /** 'YYYY-MM-DD' (focus date unless a time slot / day was tapped). */
  date: string;
  /** 'HH:mm' start suggestion, or null for all-day / untimed. */
  time: string | null;
}

// --- 2. dialogs / sheets ----------------------------------------------------------------------
type Loader = () => Promise<Component | { default: Component }> | Component;
export const dialogs = shallowReactive<Record<string, Component>>({});
/** Register the component rendered when `ui.openDialog(kind, props)` is called. It receives `props` and must emit `close`. */
export function registerDialog(kind: string, loader: Loader): void {
  const probe = loader as () => unknown;
  dialogs[kind] = markRaw(defineAsyncComponent(async () => {
    const m = (await probe()) as Component | { default: Component };
    return ('default' in (m as object) ? (m as { default: Component }).default : m) as Component;
  }));
}

// --- 3. item renderers (chips in month/week/day, blocks in the time grid) ---------------------------
export type ItemVariant = 'dot' | 'chip' | 'card' | 'allday' | 'block';
export interface ItemRendererProps {
  segment: Segment;
  variant: ItemVariant;
  /** Pixel height available (variant 'block'). */
  height?: number;
}
export const itemRenderers = shallowReactive<Partial<Record<CalendarItem['kind'], Component>>>({});
/** Replace the default chip for events or task lists. Emits `open` (default handler: openItem). */
export function registerItemRenderer(kind: CalendarItem['kind'], c: Component): void {
  itemRenderers[kind] = markRaw(c);
}

/** What happens when an item is opened (tap on a chip). Features override per kind. */
type Opener = (item: CalendarItem) => void;
const openers: Partial<Record<CalendarItem['kind'], Opener>> = {};
export function registerItemOpener(kind: CalendarItem['kind'], fn: Opener): void {
  openers[kind] = fn;
}
export function openItem(item: CalendarItem): void {
  const o = openers[item.kind];
  if (o) o(item);
  else useUiStore().openDialog(item.kind === 'event' ? 'event' : 'tasklist-expanded', { id: item.id });
}

// --- 4. top app bar widgets (flame, plant, ...) ----------------------------------------------------
export type WidgetSlot = 'leading' | 'trailing';
export const topBarWidgets = reactive<{ leading: Component[]; trailing: Component[] }>({ leading: [], trailing: [] });
export function registerTopBarWidget(slot: WidgetSlot, c: Component): void {
  const l = topBarWidgets[slot];
  if (!l.includes(markRaw(c))) l.push(c);
}

// --- 5. time grid layers (now marker, drop indicators, drag ghosts) -----------------------------------
export interface GridLayerProps {
  date: string;
  hourHeight: number;
}
/** Rendered inside every day column of the time grid (absolute, pointer-events: none by default). */
export const gridLayers = shallowReactive<Component[]>([]);
export function registerGridLayer(c: Component): void {
  if (!gridLayers.includes(c)) gridLayers.push(markRaw(c));
}
/**
 * Rendered once by the shell above the calendar views (year, month, week, day), e.g. the Now card. They are not part
 * of any view, so switching views keeps them mounted.
 */
export const calendarHeaders = shallowReactive<Component[]>([]);
export function registerCalendarHeader(c: Component): void {
  if (!calendarHeaders.includes(c)) calendarHeaders.push(markRaw(c));
}
/** Rendered between the view and the navigation bar (open tasks tray). */
export const trayComponents = shallowReactive<Component[]>([]);
export function registerTray(c: Component): void {
  if (!trayComponents.includes(c)) trayComponents.push(markRaw(c));
}
