import { onLongPress } from '@vueuse/core';
import type { Directive } from 'vue';

type Held = HTMLElement & { _longPress?: { stop: () => void; fired: boolean; handler: () => void } };

/** `v-long-press="fn"`: a 500 ms hold without moving calls `fn`; the click that ends the hold is swallowed so a tap action does not also run. */
export const vLongPress: Directive<Held, () => void> = {
  mounted(el, { value }) {
    const state = { stop: () => {}, fired: false, handler: value };
    state.stop = onLongPress(el, () => { state.fired = true; state.handler(); }, { delay: 500, distanceThreshold: 10 });
    el.addEventListener('click', (e) => {
      if (!state.fired) return;
      state.fired = false;
      e.stopImmediatePropagation();
      e.preventDefault();
    }, { capture: true });
    // a held finger would open the browser's own menu
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el._longPress = state;
  },
  updated(el, { value }) {
    if (el._longPress) el._longPress.handler = value;
  },
  unmounted(el) {
    el._longPress?.stop();
  },
};
