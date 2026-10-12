/** Themed top bar scenes: each scene's own parts, butterflies and the cat (theme-scenes.feature). */
import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TopBarScene from '@/features/motivation/TopBarScene.vue';
import SproutingTree from '@/features/motivation/SproutingTree.vue';
import { useClockStore } from '@/stores/clock';
import type { SceneName } from '@/features/motivation/types';

const parts = (el: Element, part: string) => el.querySelectorAll(`[data-part="${part}"]`).length;

describe('themed top bar scenes', () => {
  afterEach(() => document.body.replaceChildren());

  it.each<[SceneName, string[]]>([
    ['spring', ['sprouting-tree', 'lily-of-the-valley', 'first-flower', 'butterfly', 'cat']],
    ['summer', ['sunflower', 'sun', 'butterfly', 'cat']],
    ['fall', ['butterfly', 'cat']],
    ['winter', ['butterfly', 'cat']],
    ['mordor', ['butterfly', 'cat']],
  ])('%s shows its own parts, butterflies and one cat', (scene, want) => {
    setActivePinia(createPinia());
    const w = mount(TopBarScene, { props: { scene }, attachTo: document.body });
    const root = w.get('[data-testid="top-bar-scene"]').element;
    for (const p of want) expect(parts(root, p), p).toBeGreaterThan(0);
    expect(parts(root, 'cat')).toBe(1);
    // the ambient butterflies are scene decoration, never a reward effect
    expect(root.querySelector('[data-testid="reward-effect"]')).toBeNull();
    w.unmount();
  });

  it('keeps the season backdrop and the Mordor eye under the living layer', () => {
    setActivePinia(createPinia());
    const w = mount(TopBarScene, { props: { scene: 'mordor' } });
    expect(w.find('[data-testid="scene-mordor"]').exists()).toBe(true);
    const s = mount(TopBarScene, { props: { scene: 'winter' } });
    expect(s.find('[data-season="winter"]').exists()).toBe(true);
    expect(parts(s.element, 'sunflower') + parts(s.element, 'sprouting-tree')).toBe(0);
  });

  it('summer shows sunflowers even before any flower has grown in the garden', () => {
    setActivePinia(createPinia());
    const w = mount(TopBarScene, { props: { scene: 'summer' } });
    expect(parts(w.element, 'sunflower')).toBeGreaterThanOrEqual(5);
  });

  it('the tree leafs out over the day', () => {
    setActivePinia(createPinia());
    const clock = useClockStore();
    // the clock's zone is Europe/Berlin (CEST in April)
    const at = (hhmm: string) => {
      clock.nowTick = Date.parse(`2026-04-10T${hhmm}:00+02:00`);
      return Number(mount(SproutingTree).attributes('data-leafed'));
    };
    expect(at('05:00')).toBe(15);
    expect(at('12:00')).toBe(50);
    expect(at('20:00')).toBe(100);
  });
});
