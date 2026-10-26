/**
 * Calendar feature: event dialog (lazy), event renderer, now marker, Approaching card, drop indicator, transition
 * warnings. Registered once from extensions/builtin.ts. Other features can reuse `useCalendarDrag` (./dnd).
 */
import { registerDialog, registerGridLayer, registerCalendarHeader, registerItemRenderer } from '@/extensions/registry';
import DrawBlock from './DrawBlock.vue';
import DropIndicator from './DropIndicator.vue';
import EventItem from './EventItem.vue';
import NowCard from './NowCard.vue';
import { usePrefsStore } from '@/stores/prefs';
import NowMarker from './NowMarker.vue';
import { startTransitionWarnings } from './transitionWarning';
import './calendar.css';

export { useCalendarDrag, applyMove, planMove } from './dnd';

let done = false;
export function registerCalendarFeature(): void {
  startTransitionWarnings(); // (re)binds to the active Pinia
  if (done) return;
  done = true;
  registerDialog('event', () => import('./EventDialog.vue'));
  // the same dialog in birthday mode: its own kind, so switching Event <-> Birthday in the "new" dialog remounts it
  registerDialog('birthday', () => import('./EventDialog.vue'));
  registerItemRenderer('event', EventItem);
  registerGridLayer(DropIndicator);
  registerGridLayer(DrawBlock);
  registerGridLayer(NowMarker);
  // the Approaching card can be switched off in the settings (pref `approachingCard`)
  registerCalendarHeader(NowCard, () => usePrefsStore().approachingCard);
}
