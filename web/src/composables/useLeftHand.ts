import { computed } from 'vue';
import { usePrefsStore } from '@/stores/prefs';
import { isTouchLayout } from './useViewport';

/**
 * Whether the mirrored left-handed layout applies now: the person's `leftHanded` pref, on a phone or a touch tablet
 * (feature left-handed-mode). CSS reads `html[data-hand='left'][data-touch]`; JS positions (the cats) read
 * this instead.
 */
export function useLeftHand() {
  const prefs = usePrefsStore();
  return computed(() => prefs.leftHanded && isTouchLayout.value);
}
