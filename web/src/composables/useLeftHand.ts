import { computed } from 'vue';
import { usePrefsStore } from '@/stores/prefs';
import { isPhone } from './useViewport';

/**
 * Whether the mirrored left-handed layout applies now: the person's `leftHanded` pref, on the phone layout only
 * (ARCHITECTURE "Left-handed mode"). CSS reads `html[data-hand='left']` inside the phone media query; JS positions
 * (the cats) read this instead.
 */
export function useLeftHand() {
  const prefs = usePrefsStore();
  return computed(() => prefs.leftHanded && isPhone.value);
}
