/** Seasonal scenes move for ten seconds after opening, then rest as a still picture (theme-scenes.feature). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, h, nextTick, ref } from 'vue';
import TopBarScene from '@/features/motivation/TopBarScene.vue';
import { SCENE_AWAKE_MS, sceneStill, useSceneRest } from '@/features/motivation/sceneRest';
import { useClockStore } from '@/stores/clock';
import { __setSystemReducedForTest, setAnimationSetting, useAnimationLevel } from '@/motion/level';
import { enableTimerCounting } from '@/lib/timers';
import type { SceneName } from '@/features/motivation/types';

const html = () => document.documentElement.dataset.scenes;

/** Sets `document.hidden` and tells the app, as a phone does when the app goes to the background and back. */
function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
  document.dispatchEvent(new Event('visibilitychange'));
}

/** The shell: runs the rest clock for the given scene (the motion level system on, as in App.vue). */
const scene = ref<string>('halloween');
const Shell = defineComponent({
  setup() {
    useAnimationLevel();
    useSceneRest(() => scene.value);
    return () => h('div');
  },
});

describe('seasonal scenes rest after ten seconds', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    scene.value = 'halloween';
  });
  afterEach(() => {
    document.body.replaceChildren();
    setAnimationSetting('full');
    __setSystemReducedForTest(false);
    setHidden(false);
    delete window.__butterflyNow;
    vi.useRealTimers();
  });

  it('moves right after opening and is still after ten seconds', async () => {
    const w = mount(Shell);
    expect(sceneStill.value).toBe(false);
    expect(html()).toBe('moving');
    await vi.advanceTimersByTimeAsync(SCENE_AWAKE_MS - 1);
    expect(html()).toBe('moving');
    await vi.advanceTimersByTimeAsync(1);
    expect(sceneStill.value).toBe(true);
    expect(html()).toBe('still');
    w.unmount();
    expect(html()).toBeUndefined();
  });

  it('is still from the start when the device asks for reduced motion (and at Reduced or Off)', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
    const w = mount(Shell);
    expect(html()).toBe('still');
    vi.unstubAllGlobals();
    __setSystemReducedForTest(false);
    await nextTick();
    expect(html()).toBe('moving');
    setAnimationSetting('reduced');
    await nextTick();
    expect(html()).toBe('still');
    setAnimationSetting('off');
    await nextTick();
    expect(html()).toBe('still');
    w.unmount();
  });

  it('rests while hidden and plays the ten seconds again when the app comes back', async () => {
    const w = mount(Shell);
    await vi.advanceTimersByTimeAsync(SCENE_AWAKE_MS);
    expect(html()).toBe('still');
    setHidden(true);
    await nextTick();
    expect(html()).toBe('still');
    setHidden(false);
    await nextTick();
    expect(html()).toBe('moving');
    await vi.advanceTimersByTimeAsync(SCENE_AWAKE_MS);
    expect(html()).toBe('still');
    w.unmount();
  });

  it('a newly chosen scene moves for ten seconds too', async () => {
    const w = mount(Shell);
    await vi.advanceTimersByTimeAsync(SCENE_AWAKE_MS);
    expect(html()).toBe('still');
    scene.value = 'spring';
    await nextTick();
    expect(html()).toBe('moving');
    await vi.advanceTimersByTimeAsync(SCENE_AWAKE_MS);
    expect(html()).toBe('still');
    w.unmount();
  });

  it('leaves no timer once still, and none after unmount', async () => {
    enableTimerCounting();
    const before = window.__appTimers ?? 0;
    const w = mount(Shell);
    expect(window.__appTimers).toBe(before + 1);
    await vi.advanceTimersByTimeAsync(SCENE_AWAKE_MS);
    expect(window.__appTimers).toBe(before);
    w.unmount();
    expect(window.__appTimers).toBe(before);
    enableTimerCounting(false);
  });

  it('at Reduced no timer runs, not even after a hidden/visible round trip', async () => {
    enableTimerCounting();
    setAnimationSetting('reduced');
    const before = window.__appTimers ?? 0;
    const w = mount(Shell);
    expect(html()).toBe('still');
    expect(window.__appTimers).toBe(before);
    setHidden(true);
    setHidden(false);
    await nextTick();
    expect(html()).toBe('still');
    expect(window.__appTimers).toBe(before);
    // back to Full: the scene plays its ten seconds
    setAnimationSetting('full');
    await nextTick();
    expect(html()).toBe('moving');
    expect(window.__appTimers).toBe(before + 1);
    w.unmount();
    expect(window.__appTimers).toBe(before);
    enableTimerCounting(false);
  });

  it('starting hidden, or a scene change while hidden, does not wake the scene', async () => {
    setHidden(true);
    const w = mount(Shell);
    expect(html()).toBe('still');
    scene.value = 'spring';
    await nextTick();
    expect(html()).toBe('still');
    setHidden(false);
    await nextTick();
    expect(html()).toBe('moving');
    w.unmount();
  });

  it('a still Halloween scene has no visitor and no visitor timers; the visit ends when the scene comes to rest', async () => {
    enableTimerCounting();
    setActivePinia(createPinia());
    useClockStore().config.testMode = true;
    window.__butterflyNow = true;
    const before = window.__appTimers ?? 0;
    const shell = mount(Shell);
    const w = mount(TopBarScene, { props: { scene: 'halloween' as SceneName }, attachTo: document.body });
    await flushPromises();
    // the test hook brings the bat at once while the scene moves
    expect(w.findAll('[data-part="bat"]')).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(SCENE_AWAKE_MS);
    expect(w.findAll('[data-part="bat"]')).toHaveLength(0);
    expect(w.findAll('[data-part="ghost"]')).toHaveLength(0);
    // only the scene's own timers would count; none are left
    expect(window.__appTimers).toBe(before);
    w.unmount();
    shell.unmount();
    enableTimerCounting(false);
  });

  it.each([
    [0.2, 'bat'],
    [0.7, 'ghost'],
  ])('Halloween (roll %s): the %s passes once while the scene moves, then nothing comes any more', async (roll, who) => {
    setActivePinia(createPinia());
    vi.spyOn(Math, 'random').mockReturnValue(roll);
    const shell = mount(Shell);
    const w = mount(TopBarScene, { props: { scene: 'halloween' as SceneName }, attachTo: document.body });
    await flushPromises();
    const other = who === 'bat' ? 'ghost' : 'bat';
    expect(w.findAll(`[data-part="${who}"]`)).toHaveLength(1);
    expect(w.findAll(`[data-part="${other}"]`)).toHaveLength(0);
    if (who === 'ghost') expect(w.get('[data-part="ghost"]').classes()).toContain('float');
    await vi.advanceTimersByTimeAsync(SCENE_AWAKE_MS);
    expect(w.findAll('[data-part="bat"], [data-part="ghost"]')).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(w.findAll('[data-part="bat"], [data-part="ghost"]')).toHaveLength(0);
    // coming back: one visitor passes again
    setHidden(true);
    setHidden(false);
    await nextTick();
    expect(w.findAll('[data-part="bat"], [data-part="ghost"]')).toHaveLength(1);
    w.unmount();
    shell.unmount();
    vi.restoreAllMocks();
  });

  it('Mordor is not a seasonal scene: its visitor keeps its rhythm while the seasonal scenes rest', async () => {
    setActivePinia(createPinia());
    useClockStore().config.testMode = true;
    window.__butterflyNow = true;
    const shell = mount(Shell);
    await vi.advanceTimersByTimeAsync(SCENE_AWAKE_MS);
    const w = mount(TopBarScene, { props: { scene: 'mordor' as SceneName }, attachTo: document.body });
    await flushPromises();
    expect(w.findAll('[data-part="butterfly"]')).toHaveLength(1);
    w.unmount();
    shell.unmount();
  });
});
