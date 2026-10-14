import { ref } from 'vue';
import { DisposerBag, listen } from '@/lib/timers';

const PHONE_QUERY = '(max-width: 767.98px)';
/** The one condition for "held in the hand": the phone layout, or a touch device (coarse pointer) up to a large iPad. */
const TOUCH_QUERY = `${PHONE_QUERY}, (pointer: coarse) and (max-width: 1366px)`;

const has = typeof matchMedia === 'function';
/** Phone layout below 768 px (ARCHITECTURE §5). One shared media query listener, ref-counted. */
const isPhone = ref(has ? matchMedia(PHONE_QUERY).matches : true);
/** Phone or touch tablet: where left-handed mode applies. Also published as `html[data-touch]` for CSS. */
const isTouchLayout = ref(has ? matchMedia(TOUCH_QUERY).matches : true);
let users = 0;
const bag = new DisposerBag();

/** Mirrors the touch layout onto `<html data-touch>`; the CSS of left-handed mode keys off it (`html[data-hand='left'][data-touch]`). */
function publishTouch(on: boolean) {
  isTouchLayout.value = on;
  if (typeof document === 'undefined') return;
  if (on) document.documentElement.dataset.touch = '';
  else delete document.documentElement.dataset.touch;
}

export function acquireViewport(): () => void {
  if (users++ === 0 && has) {
    const m = matchMedia(PHONE_QUERY);
    isPhone.value = m.matches;
    bag.add(listen(m, 'change', (e: Event) => { isPhone.value = (e as MediaQueryListEvent).matches; }));
    const t = matchMedia(TOUCH_QUERY);
    publishTouch(t.matches);
    bag.add(listen(t, 'change', (e: Event) => publishTouch((e as MediaQueryListEvent).matches)));
  }
  let done = false;
  return () => {
    if (done) return;
    done = true;
    if (--users === 0) bag.dispose();
  };
}
export { isPhone, isTouchLayout };
