import { computed } from 'vue';
import { usePrefsStore } from '@/stores/prefs';
import { railSide, resolveNavPosition } from '@/lib/navPosition';
import { isPhone } from './useViewport';
import { useLeftHand } from './useLeftHand';

/** Where the view switcher sits now (`bottom`, `top` or `rail`) and, for the rail, on which side of the screen. */
export function useNavPosition() {
  const prefs = usePrefsStore();
  const leftHand = useLeftHand();
  const position = computed(() => resolveNavPosition(isPhone.value, prefs));
  const side = computed(() => railSide(isPhone.value, leftHand.value));
  return { position, side };
}
