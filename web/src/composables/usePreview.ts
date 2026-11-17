/**
 * Preview copies of a calendar view (the swipe carousel's neighbour period, the theme menu's sample calendar): views given
 * `preview` provide this flag, and item renderers skip their drag/resize handlers under it. The copy is inert and `aria-hidden`
 * anyway. A preview may also bring its own sample data (`PreviewData`): the real views and the top bar then draw it instead
 * of the person's items, scene and scroll position.
 */
import { inject, provide, type InjectionKey } from 'vue';
import type { Segment } from '@/lib/items';
import type { ResolvedTheme } from '@/theme/presets';

/** What a sample calendar shows: its entries per day, the theme whose scene the bar draws, and where the hour grid starts. */
export interface PreviewData {
  segments: (date: string) => Segment[];
  theme: ResolvedTheme;
  /** The theme is dark: its scene picture takes the dark variant whatever the page is. */
  dark: boolean;
  /** The sample is a still picture: nothing in it moves, so nothing needs to be kept in step. */
  still: boolean;
  /** Minutes after midnight at the top of the hour grid. */
  gridStart: number;
}

const previewKey: InjectionKey<boolean> = Symbol('preview');
const dataKey: InjectionKey<PreviewData> = Symbol('preview-data');

/** Marks the calling view's subtree as a preview copy (call in setup when its `preview` prop is set), optionally with sample data. */
export function providePreview(on: boolean | undefined, data?: PreviewData): void {
  if (on) provide(previewKey, true);
  if (on && data) provide(dataKey, data);
}

/** True inside a preview copy of a view. Call in setup. */
export function inPreview(): boolean {
  return inject(previewKey, false);
}

/** The sample data of the enclosing preview, or null in the real calendar. Call in setup. */
export function previewData(): PreviewData | null {
  return inject(dataKey, null);
}
