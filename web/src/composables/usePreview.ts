/**
 * Preview copies of a calendar view (the swipe carousel's neighbour period): views given `preview` provide this flag,
 * and item renderers skip their drag/resize handlers under it. The copy is inert and `aria-hidden` anyway.
 */
import { inject, provide, type InjectionKey } from 'vue';

const previewKey: InjectionKey<boolean> = Symbol('preview');

/** Marks the calling view's subtree as a preview copy (call in setup when its `preview` prop is set). */
export function providePreview(on: boolean | undefined): void {
  if (on) provide(previewKey, true);
}

/** True inside a preview copy of a view. Call in setup. */
export function inPreview(): boolean {
  return inject(previewKey, false);
}
