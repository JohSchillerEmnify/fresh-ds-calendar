import { computed } from 'vue';
import { usePrefsStore } from '@/stores/prefs';
import { isPhone } from './useViewport';

/** Whether the week is shown in two rows now: the choice of the current screen size (feature week-two-row). */
export function useWeekTwoRow() {
  const prefs = usePrefsStore();
  return computed(() => (isPhone.value ? prefs.weekTwoRowPhone : prefs.weekTwoRowWide));
}
