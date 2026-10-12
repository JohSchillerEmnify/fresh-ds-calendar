import { ref } from 'vue';
import { DisposerBag, listen } from '@/lib/timers';

/** Phone layout below 768 px (ARCHITECTURE §5). One shared media query listener, ref-counted. */
const isPhone = ref(typeof matchMedia === 'function' ? matchMedia('(max-width: 767.98px)').matches : true);
let users = 0;
const bag = new DisposerBag();

export function acquireViewport(): () => void {
  if (users++ === 0 && typeof matchMedia === 'function') {
    const m = matchMedia('(max-width: 767.98px)');
    isPhone.value = m.matches;
    bag.add(listen(m, 'change', (e: Event) => { isPhone.value = (e as MediaQueryListEvent).matches; }));
  }
  let done = false;
  return () => {
    if (done) return;
    done = true;
    if (--users === 0) bag.dispose();
  };
}
export { isPhone };
