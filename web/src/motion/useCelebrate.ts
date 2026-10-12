import { onScopeDispose, getCurrentScope, type Ref } from 'vue';
import { animate } from './animate';
import { spawnConfetti } from './effects';
import { haptic } from './haptics';
import { springs } from './spring';

/** Bigger list-complete burst + card bounce. `celebrate()` never throws and never blocks. */
export function useCelebrate(cardEl: Ref<Element | null | undefined> | (() => Element | null | undefined)) {
  const get = () => (typeof cardEl === 'function' ? cardEl() : cardEl.value);
  let anim: Animation | null = null;
  function celebrate(): void {
    const el = get();
    if (!el) return;
    const r = el.getBoundingClientRect();
    spawnConfetti({ x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 90) });
    anim?.cancel();
    anim = animate(el, [{ transform: 'scale(0.95)' }, { transform: 'scale(1)' }], {
      spring: springs.pop,
      reduced: 'fade',
    });
    haptic([10, 30, 10]);
  }
  if (getCurrentScope()) onScopeDispose(() => anim?.cancel());
  return { celebrate };
}
