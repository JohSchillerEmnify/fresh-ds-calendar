/** Themed top bar scenes: each scene's own parts, butterflies and the cat (theme-scenes.feature). */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TopBarScene from '@/features/motivation/TopBarScene.vue';
import SproutingTree from '@/features/motivation/SproutingTree.vue';
import { useClockStore } from '@/stores/clock';
import { setAnimationSetting } from '@/motion/level';
import { enableTimerCounting } from '@/lib/timers';
import { BUTTERFLY_VISIT_MS, GHOST_RHYTHM, butterflyFlight, butterflyWait, forcedButterfly, visitWait } from '@/features/motivation/butterflyVisits';
import type { SceneName } from '@/features/motivation/types';

const parts = (el: Element, part: string) => el.querySelectorAll(`[data-part="${part}"]`).length;

describe('themed top bar scenes', () => {
  afterEach(() => {
    document.body.replaceChildren();
    delete window.__butterflyNow;
    setAnimationSetting('full');
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** Mounts a scene; `hook` sets the butterfly test hook in test mode first. */
  const mountScene = (scene: SceneName, hook = false) => {
    setActivePinia(createPinia());
    if (hook) {
      useClockStore().config.testMode = true;
      window.__butterflyNow = true;
    }
    return mount(TopBarScene, { props: { scene }, attachTo: document.body });
  };

  it.each<[SceneName, string[]]>([
    ['spring', ['sprouting-tree', 'lily-of-the-valley', 'first-flower', 'butterfly', 'cat']],
    ['summer', ['sunflower', 'sun', 'butterfly', 'cat']],
    ['fall', ['butterfly', 'cat']],
    ['winter', ['butterfly', 'cat']],
    ['mordor', ['butterfly', 'cat']],
    ['halloween', ['moon', 'bare-tree', 'jack-o-lantern', 'pumpkin', 'bat', 'cat']],
  ])('%s shows its own parts, a visiting butterfly (a bat at Halloween) and one cat', (scene, want) => {
    const w = mountScene(scene, true);
    const root = w.get('[data-testid="top-bar-scene"]').element;
    for (const p of want) expect(parts(root, p), p).toBeGreaterThan(0);
    expect(parts(root, 'cat')).toBe(1);
    // one visitor at a time, and at Halloween it is a bat instead of a butterfly
    const [flyer, other] = scene === 'halloween' ? ['bat', 'butterfly'] : ['butterfly', 'bat'];
    expect(parts(root, flyer)).toBe(1);
    expect(parts(root, other)).toBe(0);
    // the visiting butterfly is scene decoration, never a reward effect
    expect(root.querySelector('[data-testid="reward-effect"]')).toBeNull();
    w.unmount();
  });

  it('a butterfly comes by only now and then: first after 20–60 s, ~10 s long, then again after 3–5 min', async () => {
    vi.useFakeTimers();
    // random = 0.5: first visit after 40 s, the next 4 min after it left
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const w = mountScene('fall');
    const has = () => parts(w.element, 'butterfly');
    expect(has()).toBe(0);
    await vi.advanceTimersByTimeAsync(39_999);
    expect(has()).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(has()).toBe(1);
    await vi.advanceTimersByTimeAsync(BUTTERFLY_VISIT_MS);
    expect(has()).toBe(0);
    await vi.advanceTimersByTimeAsync(239_999);
    expect(has()).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(has()).toBe(1);
    w.unmount();
  });

  it('Reduced: the butterfly only rests in place; Off: none, even with the test hook', async () => {
    setAnimationSetting('reduced');
    const r = mountScene('winter', true);
    expect(r.get('[data-part="butterfly"]').classes()).toContain('rest');
    r.unmount();
    setAnimationSetting('off');
    const o = mountScene('winter', true);
    expect(parts(o.element, 'butterfly')).toBe(0);
    o.unmount();
  });

  it('the hook is ignored outside test mode and leaves no timers after unmount', () => {
    enableTimerCounting();
    const before = window.__appTimers ?? 0;
    window.__butterflyNow = true;
    const w = mountScene('spring');
    expect(parts(w.element, 'butterfly')).toBe(0);
    expect(window.__appTimers).toBe(before + 1);
    w.unmount();
    expect(window.__appTimers).toBe(before);
    enableTimerCounting(false);
  });

  it.each<[SceneName, string[]]>([
    ['easter', ['easter-egg', 'hare', 'first-flower', 'cat']],
    ['summerholidays', ['sea', 'sun', 'beach-umbrella', 'cat']],
    ['christmas', ['xmas-tree', 'advent-candle', 'snow', 'cat']],
    ['newyearseve', ['firework', 'skyline', 'star', 'cat']],
    ['newyear', ['sunrise', 'confetti', 'hill', 'cat']],
  ])('%s has its own parts and one cat; only the cat\'s winter-holiday siblings have no butterfly', (scene, want) => {
    const w = mountScene(scene, true);
    const root = w.get('[data-testid="top-bar-scene"]').element;
    for (const p of want) expect(parts(root, p), p).toBeGreaterThan(0);
    expect(parts(root, 'cat')).toBe(1);
    expect(parts(root, 'butterfly')).toBe(['easter', 'summerholidays'].includes(scene) ? 1 : 0);
    w.unmount();
  });

  it.each([
    ['2026-11-29', 1, 'off'], ['2026-12-06', 2, 'off'], ['2026-12-13', 3, 'off'], ['2026-12-20', 4, 'off'], ['2026-12-23', 4, 'off'],
    ['2026-12-24', 4, 'on'], ['2026-12-30', 4, 'on'], ['2026-04-12', 4, 'on'],
  ])('Christmas on %s: %i lit candles, tree lights %s, the tree after the candles', (date, lit, lights) => {
    setActivePinia(createPinia());
    useClockStore().nowTick = Date.parse(`${date}T12:00:00+01:00`);
    const w = mount(TopBarScene, { props: { scene: 'christmas' } });
    expect(w.findAll('[data-testid="advent-candle"]')).toHaveLength(4);
    expect(w.findAll('[data-testid="advent-candle"][data-lit="true"]')).toHaveLength(lit);
    expect(w.get('[data-testid="xmas-tree"]').attributes('data-lights')).toBe(lights);
    // timeline order: the candles come first in the DOM, the tree after them
    const all = [...w.element.querySelectorAll('[data-testid="advent-candle"], [data-testid="xmas-tree"]')].map((e) => e.getAttribute('data-testid'));
    expect(all).toEqual(['advent-candle', 'advent-candle', 'advent-candle', 'advent-candle', 'xmas-tree']);
    expect(w.findAll('[data-testid="advent-candle"]').map((c) => c.attributes('data-lit'))).toEqual([0, 1, 2, 3].map((i) => String(i < lit)));
    w.unmount();
  });

  it('Halloween: the jack-o\'-lanterns glow, the cat sits next to a pumpkin, and no ghost is there between visits', () => {
    const w = mountScene('halloween');
    expect(w.find('[data-season="halloween"]').exists()).toBe(true);
    expect(parts(w.element, 'jack-o-lantern')).toBeGreaterThanOrEqual(2);
    expect(w.findAll('[data-part="jack-o-lantern"] .flame').length).toBe(parts(w.element, 'jack-o-lantern'));
    expect(parts(w.element, 'pumpkin')).toBe(1);
    expect(parts(w.element, 'ghost')).toBe(0);
    w.unmount();
  });

  it('the ghost floats past every 8–12 min for ~8 s; Reduced fades it in place; Off has none', async () => {
    vi.useFakeTimers();
    // random = 0.5: the ghost comes after 10 min, the bat after 40 s and 4 min after that
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const w = mountScene('halloween');
    const ghost = () => w.findAll('[data-part="ghost"]');
    await vi.advanceTimersByTimeAsync(599_999);
    expect(ghost()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(ghost()).toHaveLength(1);
    expect(ghost()[0].classes()).toContain('float');
    await vi.advanceTimersByTimeAsync(GHOST_RHYTHM.lengthMs);
    expect(ghost()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(ghost()).toHaveLength(1);
    // a level change ends the visit and waits afresh; Reduced fades in place
    setAnimationSetting('reduced');
    await vi.advanceTimersByTimeAsync(0);
    expect(ghost()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(ghost()[0].classes()).toContain('fade');
    setAnimationSetting('off');
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(ghost()).toHaveLength(0);
    w.unmount();
  });

  it('Halloween leaves no timers after unmount (bat and ghost each wait on one)', () => {
    enableTimerCounting();
    const before = window.__appTimers ?? 0;
    const w = mountScene('halloween');
    expect(window.__appTimers).toBe(before + 2);
    w.unmount();
    expect(window.__appTimers).toBe(before);
    enableTimerCounting(false);
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

describe('lazy scene registry', () => {
  it('the real registry loads a holiday scene on demand and then renders its parts', async () => {
    setActivePinia(createPinia());
    const real = await vi.importActual<typeof import('@/features/motivation/scenes')>('@/features/motivation/scenes');
    const w = mount(real.scenes.easter!, { attachTo: document.body });
    await vi.waitFor(async () => { await flushPromises(); expect(parts(w.element, 'easter-egg')).toBeGreaterThan(0); });
    expect(parts(w.element, 'cat')).toBe(1);
    w.unmount();
  });
});

describe('butterfly visit schedule', () => {
  it('waits 20–60 s for the first visit, 3–5 min for the next, nothing when forced', () => {
    expect(butterflyWait(true, false, 0)).toBe(20_000);
    expect(butterflyWait(true, false, 0.999999)).toBe(60_000);
    expect(butterflyWait(false, false, 0)).toBe(180_000);
    expect(butterflyWait(false, false, 0.5)).toBe(240_000);
    expect(butterflyWait(true, true, 0.7)).toBe(0);
  });

  it('flies through at Full (sometimes resting), only rests at Reduced, none at Off', () => {
    expect(butterflyFlight('full', 0.1)).toBe('fly-rest');
    expect(butterflyFlight('full', 0.9)).toBe('fly');
    expect(butterflyFlight('reduced', 0.9)).toBe('rest');
    expect(butterflyFlight('off', 0.1)).toBeNull();
  });

  it('the ghost waits 8–12 min before each visit and stays ~8 s', () => {
    expect(visitWait(GHOST_RHYTHM, true, false, 0)).toBe(480_000);
    expect(visitWait(GHOST_RHYTHM, false, false, 0.999999)).toBe(720_000);
    expect(GHOST_RHYTHM.lengthMs).toBe(8_000);
  });

  it('honours the test hook only in test mode', () => {
    expect(forcedButterfly(true, { __butterflyNow: true })).toBe(true);
    expect(forcedButterfly(false, { __butterflyNow: true })).toBe(false);
    expect(forcedButterfly(true, {})).toBe(false);
  });
});
