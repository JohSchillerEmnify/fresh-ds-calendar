/**
 * Calendar feature: event dialog (lazy), event renderer, now marker, Now card, drop indicator, transition warnings.
 * Registered once from extensions/builtin.ts. Other features can reuse `useCalendarDrag` (./dnd) and
 * `registerNowCardLine` (./nowLines).
 */
import { registerDialog, registerGridLayer, registerItemRenderer, registerViewHeader } from '@/extensions/registry';
import DropIndicator from './DropIndicator.vue';
import EventItem from './EventItem.vue';
import NowCard from './NowCard.vue';
import NowMarker from './NowMarker.vue';
import { startTransitionWarnings } from './transitionWarning';
import './calendar.css';

export { useCalendarDrag, applyMove, planMove } from './dnd';
export { registerNowCardLine } from './nowLines';

let done = false;
export function registerCalendarFeature(): void {
  startTransitionWarnings(); // (re)binds to the active Pinia
  if (done) return;
  done = true;
  registerDialog('event', () => import('./EventDialog.vue'));
  registerItemRenderer('event', EventItem);
  registerGridLayer(DropIndicator);
  registerGridLayer(NowMarker);
  registerViewHeader('time', NowCard);
  registerViewHeader('month', NowCard);
  registerViewHeader('year', NowCard);
}
