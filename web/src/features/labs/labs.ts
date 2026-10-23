import type { Component } from 'vue';
import type { MessageKey } from '@/i18n';
import { IconSchedule as IconClock, IconTimeline, IconSwapHoriz, IconViewColumn as IconStrip, IconZoomIn } from '@/components/icons';
import { toIsoDate } from '@/lib/dates';

/** One experimental view the view switcher can offer. */
export interface LabsView {
  /** Route name and the part after `view-switch-` / `settings-labs-view-` in test ids. */
  id: string;
  /** i18n key of the view's name. */
  labelKey: MessageKey;
  icon: Component;
  /** Base route path (a dated view appends `/:date`). */
  route: string;
  /** Whether the view is offered until the person decides otherwise. */
  defaultOn: boolean;
}

/** Every Labs view; adding an entry here adds its switch in the settings and its tab in the view switcher. */
export const LABS_VIEWS: readonly LabsView[] = [
  { id: 'clock', labelKey: 'views.clock', icon: IconClock, route: '/clock', defaultOn: true },
  { id: 'clock-rings', labelKey: 'views.clockRings', icon: IconClock, route: '/clock-rings', defaultOn: false },
  { id: 'timeline', labelKey: 'views.timeline', icon: IconTimeline, route: '/timeline', defaultOn: true },
  { id: 'strip', labelKey: 'views.strip', icon: IconStrip, route: '/strip', defaultOn: false },
  { id: 'zoom', labelKey: 'views.zoom', icon: IconZoomIn, route: '/zoom', defaultOn: true },
  { id: 'horizontal', labelKey: 'views.horizontal', icon: IconSwapHoriz, route: '/horizontal', defaultOn: true },
];

/** Whether the person has the Labs view `id` switched on; without a stored choice the registry default applies, and an unknown id is on. */
export function isLabsViewOn(id: string, chosen: Record<string, boolean>): boolean {
  return chosen[id] ?? LABS_VIEWS.find((v) => v.id === id)?.defaultOn ?? true;
}

/** The Labs views the view switcher offers: none with Labs off, else those switched on. */
export function visibleLabsViews(labsOn: boolean, chosen: Record<string, boolean>): LabsView[] {
  return labsOn ? LABS_VIEWS.filter((v) => isLabsViewOn(v.id, chosen)) : [];
}

/** Route path of an experimental Labs view; the timeline has no date. */
export function labPath(lab: string, d: Date): string {
  return lab === 'timeline' ? '/timeline' : `/${lab}/${toIsoDate(d)}`;
}
