import { onLongPress } from '@vueuse/core';
import type { Directive } from 'vue';

type Held = HTMLElement & { _longPress?: { stop: () => void; handler: () => void } };

/** Swallows one click: the click that ends a hold would land on whatever opened under the finger (a sheet's scrim) or run the tap action. */
function swallow(e: Event) {
  e.stopImmediatePropagation();
  e.preventDefault();
}

/** `v-long-press="fn"`: a 500 ms hold without moving calls `fn`; the click that ends the hold is swallowed. */
export const vLongPress: Directive<Held, () => void> = {
  mounted(el, { value }) {
    const state = { stop: () => {}, handler: value };
    state.stop = onLongPress(el, () => {
      document.addEventListener('click', swallow, { capture: true, once: true });
      state.handler();
    }, {
      delay: 500,
      distanceThreshold: 10,
      // a release without a click (touch often sends none) must not eat a later, real tap
      onMouseUp: (_d, _dist, held) => { if (held) setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 400); },
    });
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
