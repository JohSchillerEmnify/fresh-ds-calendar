/** Whether handwriting is on and whether this device gets the larger ruled writing area (decisions A6, R4, T1, Q9). */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { isRuled } from '@/lib/ink';
import { useInkStore } from '@/stores/ink';
import { usePrefsStore } from '@/stores/prefs';

export function useInkMode() {
  const prefs = usePrefsStore();
  const ink = useInkStore();
  const width = ref(typeof window === 'undefined' ? 0 : window.innerWidth);
  const touch = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
  const resize = (): void => { width.value = window.innerWidth; };
  onMounted(() => window.addEventListener('resize', resize));
  onBeforeUnmount(() => window.removeEventListener('resize', resize));
  const enabled = computed(() => prefs.labs && prefs.labsHandwriting);
  const ruled = computed(() => isRuled({ enabled: enabled.value, penSeen: ink.penSeen, width: width.value, touch }));
  return { enabled, ruled };
}
