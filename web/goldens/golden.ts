/**
 * Component goldens (`pnpm goldens`): renders calendar item components with fixed props in Vitest browser mode and
 * compares each shot with its committed baseline. Every state is shot in both themes at phone and desktop width.
 */
import '@/styles.css';
import '@/theme/theme.css';
import '@/features/calendar/calendar.css';
import '@/features/tasklists/tasklists.css';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { defineComponent, h, provide, type Component } from 'vue';
import { expect } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-vue';
import type { CalendarEvent, TaskItem, TaskList } from '@/api/types';
import { acquireViewport } from '@/composables/useViewport';
import { itemSegments, type Segment } from '@/lib/items';
import { sectionKey } from '@/features/tasklists/section';

/** Both themes of the app (`html[data-theme]`). */
export const THEMES = ['light', 'dark'] as const;
/** Phone and desktop viewport widths in CSS px. */
export const WIDTHS = { phone: 360, desktop: 1280 } as const;

/** A fixed day far from the real today, so no entry is drawn as past or running. */
export const DAY = '2030-01-07';

/** One sized box of a golden sheet: the component, its props and the room its host gives it. */
export interface Cell {
  /** Caption-free key, only for readable failures. */
  key: string;
  component: Component;
  props: Record<string, unknown>;
  /** Width of the host box in px. */
  w: number;
  /** Height of the host box in px; omitted = as tall as the content. */
  h?: number;
  /** Section mode the band would provide (`titles` or `full`). */
  section?: 'titles' | 'full';
  /** Extra CSS on the host box (custom properties a host sets, a grid for bars). */
  style?: Record<string, string>;
}

/**
 * Build a task list fixture.
 *
 * Args:
 *   o: Fields to override; `items` as `[title, done]` pairs.
 *
 * Returns:
 *   A complete `TaskList` on {@link DAY}.
 */
export function list(o: Partial<Omit<TaskList, 'items'>> & { items?: [string, boolean][] } = {}): TaskList {
  const { items: pairs = [['Milk', false], ['Eggs', false], ['Bread', false]], ...rest } = o;
  const items: TaskItem[] = pairs.map(([title, done], n) => ({ id: `i${n}`, title, done }));
  return {
    kind: 'tasklist', id: 'l1', calendarId: 'primary', title: 'Groceries', date: DAY, time: null, items, doneCount: items.filter((i) => i.done).length,
    totalCount: items.length, estimateMinutes: null, recurrence: null, categoryId: null, tags: [], color: '#039be5', etag: 'e', updated: '2030-01-01T00:00:00Z', ...rest,
  };
}

/**
 * Build an event fixture.
 *
 * Args:
 *   o: Fields to override.
 *
 * Returns:
 *   A complete timed `CalendarEvent` on {@link DAY}, 09:00 to 10:30.
 */
export function event(o: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    kind: 'event', id: 'e1', calendarId: 'primary', title: 'Team standup', description: '', location: '', allDay: false,
    start: `${DAY}T09:00:00`, end: `${DAY}T10:30:00`, colorId: null, color: '#33b679', etag: 'e', updated: '2030-01-01T00:00:00Z', ...o,
  };
}

/**
 * First segment of an item on its own day.
 *
 * Args:
 *   item: The event or task list.
 *
 * Returns:
 *   The `Segment` a view would hand to the renderer.
 */
export const segOf = (item: TaskList | CalendarEvent): Segment => itemSegments(item, DAY)[0]!;

/** Host box of one cell: fixed size, and the band's section mode for the card inside. */
const Host = defineComponent({
  props: { cell: { type: Object as () => Cell, required: true } },
  setup(p) {
    provide(sectionKey, () => p.cell.section ?? 'full');
    return () => h('div', { 'data-cell': p.cell.key, style: { width: `${p.cell.w}px`, height: p.cell.h === undefined ? 'auto' : `${p.cell.h}px`, display: 'flex', flexDirection: 'column', ...p.cell.style } },
      [h(p.cell.component, p.cell.props)]);
  },
});

/** The sheet: every cell in a wrapping row on the surface colour, like a calendar behind the entries. */
const Sheet = defineComponent({
  props: { cells: { type: Array as () => Cell[], required: true } },
  setup(p) {
    return () => h('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '8px', padding: '8px', background: 'var(--md-sys-color-surface)' } },
      p.cells.map((c) => h(Host, { key: c.key, cell: c })));
  },
});

let viewport: (() => void) | null = null;
const frames = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/**
 * Render a sheet of cells in every theme and width and compare each shot with `<name>-<theme>-<width>.png`.
 *
 * Args:
 *   name: Baseline name of the state.
 *   cells: The sized component boxes to draw side by side.
 *   setup: Prepares stores before the render (prefs, settings).
 */
export async function golden(name: string, cells: Cell[], setup?: (pinia: Pinia) => void): Promise<void> {
  viewport ??= acquireViewport();
  for (const theme of THEMES) {
    for (const [width, px] of Object.entries(WIDTHS)) {
      document.documentElement.dataset.theme = theme;
      // no count bump or neon pulse mid-shot
      document.documentElement.dataset.motion = 'off';
      for (const k of ['calm', 'glow', 'entries', 'corners'] as const) delete document.documentElement.dataset[k];
      await page.viewport(px, 900);
      const pinia = createPinia();
      setActivePinia(pinia);
      setup?.(pinia);
      const screen = await render(Sheet, { props: { cells }, global: { plugins: [pinia] } });
      await document.fonts.ready;
      // the measured tiers (mini, narrow) settle after the first resize observation
      await frames();
      await expect.element(page.elementLocator(screen.container)).toMatchScreenshot(`${name}-${theme}-${width}`);
      await screen.unmount();
    }
  }
}
