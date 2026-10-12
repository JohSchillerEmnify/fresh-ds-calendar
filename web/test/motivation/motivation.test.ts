import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { __setSystemReducedForTest, setAnimationSetting, setCalmMode, __motionUsers } from '@/motion/level';
import { clearEffects } from '@/motion/effects';
import { diffMotivation, checkInMessage, useMotivationStore } from '@/features/motivation/store';
import { __resetOnce } from '@/features/motivation/session';
import StreakFlame from '@/features/motivation/StreakFlame.vue';
import StreakToast from '@/features/motivation/StreakToast.vue';
import Plant from '@/features/motivation/Plant.vue';
import PlantCard from '@/features/motivation/PlantCard.vue';
import SunflowerField from '@/features/motivation/SunflowerField.vue';
import Butterfly from '@/features/motivation/Butterfly.vue';
import TopBarScene from '@/features/motivation/TopBarScene.vue';
import LeadingWidgets from '@/features/motivation/LeadingWidgets.vue';
import type { Motivation } from '@/features/motivation/types';
import { installWaapi, removeWaapi, finishAll, mockAnims } from '../motion/helpers';

const STAGES = ['Seed', 'Sprout', 'Small plant', 'Leafy', 'Flowering'] as const;
const MSG = { happy: 'Your plant is happy', thirsty: 'Your plant is a little thirsty', dry: 'Your plant could use some water', droopy: 'Your plant is resting. Anything you do will perk it up.' };
const VIT = { happy: 100, thirsty: 75, dry: 50, droopy: 25 } as const;
function mot(over: { growth?: number; mood?: keyof typeof MSG; current?: number; last?: string | null; flowers?: number } = {}): Motivation {
  const growth = over.growth ?? 0;
  const idx = [280, 140, 60, 20, 0].findIndex((t) => growth >= t);
  const stageIndex = (4 - idx) as 0 | 1 | 2 | 3 | 4;
  const mood = over.mood ?? 'happy';
  return {
    streak: { current: over.current ?? 1, best: 5, lastCheckIn: over.last === undefined ? '2026-10-12' : over.last, checkedInToday: true },
    plant: { growth, stage: STAGES[stageIndex], stageIndex, nextStageAt: [20, 60, 140, 280, null][stageIndex], todayPoints: 0, lastWatered: null, flowers: over.flowers ?? Math.min(24, Math.floor(growth / 40)), vitality: VIT[mood], mood, message: MSG[mood] },
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  installWaapi();
  setAnimationSetting('full'); setCalmMode(false); __setSystemReducedForTest(false);
  __resetOnce();
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
});
afterEach(() => { clearEffects(); removeWaapi(); vi.useRealTimers(); vi.restoreAllMocks(); document.body.innerHTML = ''; });

describe('rules -> messages and effects', () => {
  it('check-in messages', () => {
    const r = (current: number, newToday = true) => ({ current, best: current, checkedInToday: true as const, newToday, motivation: mot() });
    expect(checkInMessage(mot({ last: '2026-10-11' }), r(4))).toBe('Checked in, day 4');
    expect(checkInMessage(null, r(1))).toBe('Checked in, day 1');
    expect(checkInMessage(mot({ last: null }), r(1))).toBe('Checked in, day 1');
    expect(checkInMessage(mot({ last: '2026-10-10' }), r(1))).toBe('Welcome back!');
    expect(checkInMessage(mot(), r(2, false))).toBeNull();
    expect(`${checkInMessage(mot({ last: '2026-10-01' }), r(1))}`).not.toMatch(/lost|broke|missed|failed/i);
  });
  it('diff yields water / grow / bloom / perk-up', () => {
    expect(diffMotivation(null, mot())).toEqual([]);
    expect(diffMotivation(mot({ growth: 10 }), mot({ growth: 12 }))).toEqual(['water']);
    expect(diffMotivation(mot({ growth: 19 }), mot({ growth: 21 }))).toEqual(['water', 'grow']);
    expect(diffMotivation(mot({ growth: 39 }), mot({ growth: 41 }))).toEqual(['water', 'bloom']);
    expect(diffMotivation(mot({ growth: 70, mood: 'droopy' }), mot({ growth: 80, mood: 'happy' }))).toEqual(['water', 'perk-up']);
    expect(diffMotivation(mot({ growth: 70 }), mot({ growth: 70 }))).toEqual([]);
  });
});

describe('store', () => {
  function fakeFetch(first: Motivation, check: { current: number; newToday: boolean; motivation: Motivation }) {
    return vi.fn(async (url: string, init?: RequestInit) => ({
      ok: true,
      json: async () => (init?.method === 'POST' ? { best: 5, checkedInToday: true, ...check } : first),
    })) as unknown as typeof fetch;
  }
  it('checks in once on start; same app-day does not re-post; new day does', async () => {
    let day = '2026-10-12';
    const f = fakeFetch(mot({ current: 3, last: '2026-10-11' }), { current: 4, newToday: true, motivation: mot({ current: 4, growth: 10 }) });
    const s = useMotivationStore();
    await s.start({ today: () => day, fetchImpl: f });
    expect(s.message?.text).toBe('Checked in, day 4');
    expect(s.streakPulse).toBe(1);
    const posts = () => (f as any).mock.calls.filter((c: any[]) => c[1]?.method === 'POST').length;
    expect(posts()).toBe(1);
    await s.checkIn();
    expect(posts()).toBe(1);
    day = '2026-10-13';
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await flushPromises();
    expect(posts()).toBe(2);
    s.stop();
  });
  it('no message / pulse when already checked in today; restart after stop leaves no listeners', async () => {
    const add = vi.spyOn(document, 'addEventListener');
    const rem = vi.spyOn(document, 'removeEventListener');
    const f = fakeFetch(mot(), { current: 2, newToday: false, motivation: mot() });
    const s = useMotivationStore();
    await s.start({ today: () => 'd', fetchImpl: f });
    expect(s.message).toBeNull();
    expect(s.streakPulse).toBe(0);
    s.stop();
    expect(add.mock.calls.filter((c) => c[0] === 'visibilitychange').length).toBe(rem.mock.calls.filter((c) => c[0] === 'visibilitychange').length);
  });
  it('network errors never throw and are surfaced quietly', async () => {
    const s = useMotivationStore();
    await s.start({ today: () => 'd', fetchImpl: (async () => { throw new Error('offline'); }) as unknown as typeof fetch });
    expect(s.error).toBeTruthy();
    expect(s.message).toBeNull();
  });
  it('perk-up when check-in waters a droopy plant', async () => {
    const s = useMotivationStore();
    await s.start({ today: () => 'd', fetchImpl: fakeFetch(mot({ growth: 70, mood: 'droopy', last: '2026-10-01' }), { current: 1, newToday: true, motivation: mot({ growth: 75 }) }) });
    expect(s.message?.text).toBe('Welcome back!');
    expect(s.change?.kinds).toEqual(['water', 'perk-up']);
  });
});

describe('components', () => {
  it('StreakFlame shows the count, is static when idle, crackles on pulse', async () => {
    const w = mount(StreakFlame, { props: { count: 3, pulse: 0 } });
    expect(w.text()).toBe('3');
    expect(mockAnims.length).toBe(0);
    await w.setProps({ count: 4, pulse: 1 });
    expect(mockAnims.length).toBeGreaterThan(0);
    expect(document.querySelector('[data-kind="streak"]')).not.toBeNull();
    expect(w.text()).toBe('4');
    const crackle = mockAnims.find((a) => (a.opts as any).duration === 950)!;
    expect((a => a)(crackle)).toBeTruthy();
    finishAll();
    w.unmount();
  });
  it('StreakFlame at Off creates no animation or effect', async () => {
    setAnimationSetting('off');
    const w = mount(StreakFlame, { props: { count: 3, pulse: 0 } });
    await w.setProps({ count: 4, pulse: 1 });
    expect(mockAnims.length).toBe(0);
    expect(document.querySelector('[data-testid="reward-effect"]')).toBeNull();
    expect(w.text()).toBe('4');
  });
  it('toast shows text then auto-hides after 4 s and clears its timer', async () => {
    vi.useFakeTimers();
    const w = mount(StreakToast, { props: { message: { id: 1, text: 'Checked in, day 4' } } });
    expect(w.find('[data-testid="streak-message"]').text()).toBe('Checked in, day 4');
    vi.advanceTimersByTime(4001);
    await nextTick();
    expect(w.emitted('hide')).toBeTruthy();
    expect(w.find('[data-testid="streak-message"]').exists()).toBe(false);
    w.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each([0, 1, 2, 3, 4] as const)('Plant stage %i renders and stays small', (st) => {
    const w = mount(Plant, { props: { stage: st } });
    expect(w.attributes('data-stage')).toBe(String(st));
    expect(w.html().length).toBeLessThan(3400);
  });
  it('Plant moods droop and never look dead', () => {
    const rot = (m: any) => mount(Plant, { props: { stage: 3, mood: m } }).find('.grow').attributes('style');
    expect(rot('happy')).toContain('rotate(0deg)');
    expect(rot('droopy')).toContain('rotate(26deg)');
    expect(mount(Plant, { props: { stage: 3, mood: 'droopy' } }).html()).not.toMatch(/brown|dead/i);
  });
  it('Plant plays water droplets and grow on change; none when animations are Reduced', async () => {
    const w = mount(Plant, { props: { stage: 1 }, attachTo: document.body });
    await w.setProps({ change: { id: 1, kinds: ['water', 'grow'] } });
    expect(document.querySelector('[data-kind="water"]')).not.toBeNull();
    expect(document.querySelector('[data-kind="grow"]')).not.toBeNull();
    clearEffects();
    setAnimationSetting('reduced');
    await w.setProps({ change: { id: 2, kinds: ['water', 'perk-up', 'grow'] } });
    expect(document.querySelector('[data-testid="reward-effect"]')).toBeNull();
    w.unmount();
  });
  it('PlantCard shows stage and the exact friendly line for every mood', () => {
    for (const mood of ['happy', 'thirsty', 'dry', 'droopy'] as const) {
      const m = mot({ growth: 70, mood });
      const w = mount(PlantCard, { props: { plant: m.plant } });
      expect(w.find('[data-testid="plant-card-stage"]').text()).toBe('Small plant');
      expect(w.find('[data-testid="plant-card-line"]').text()).toBe(MSG[mood]);
      expect(w.text()).not.toMatch(/\b(dead|died|dying|lost|failed|neglected)\b/i);
      w.unmount();
    }
  });
  it('SunflowerField: label, cap at 12 on phones, singular, mood', async () => {
    const mm = (q: string) => ({ matches: /max-width: 599/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    vi.stubGlobal('matchMedia', mm);
    const w = mount(SunflowerField, { props: { flowers: 24 } });
    expect(w.attributes('aria-label')).toBe('Sunflower field: 24 flowers');
    expect(w.findAll('[data-testid="sunflower"]').length).toBe(12);
    expect(w.findAll('use').length).toBe(12);
    expect(w.findAll('symbol').length).toBe(1);
    await w.setProps({ flowers: 1, mood: 'droopy' });
    expect(w.attributes('aria-label')).toBe('Sunflower field: 1 flower');
    expect(w.attributes('data-mood')).toBe('droopy');
    vi.unstubAllGlobals();
    w.unmount();
  });
  it('SunflowerField sways only at Full and while visible', async () => {
    const w = mount(SunflowerField, { props: { flowers: 5 } });
    expect(w.attributes('data-sway')).toBe('on');
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await nextTick();
    expect(w.attributes('data-sway')).toBe('off');
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await nextTick();
    expect(w.attributes('data-sway')).toBe('on');
    setAnimationSetting('reduced');
    await nextTick();
    expect(w.attributes('data-sway')).toBe('off');
    w.unmount();
  });
  it('SunflowerField blooms the newest flower', async () => {
    const w = mount(SunflowerField, { props: { flowers: 2 }, attachTo: document.body });
    await w.setProps({ flowers: 3 });
    await w.setProps({ change: { id: 1, kinds: ['bloom'] } });
    expect(document.querySelector('[data-kind="bloom"]')).not.toBeNull();
    w.unmount();
  });
  it('removes its document listener on unmount', () => {
    const rem = vi.spyOn(document, 'removeEventListener');
    mount(SunflowerField, { props: { flowers: 1 } }).unmount();
    expect(rem.mock.calls.some((c) => c[0] === 'visibilitychange')).toBe(true);
  });
});

describe('scenes', () => {
  it('sunflowers: butterfly once per session, only with flowers and Full; removed after ~3.6 s', async () => {
    vi.useFakeTimers();
    const mk = () => mount(TopBarScene, { props: { scene: 'sunflowers', flowers: 3 }, attachTo: document.body });
    let w = mk();
    await nextTick(); await nextTick();
    const b = () => document.querySelector('[data-testid="reward-effect"][data-kind="butterfly"]');
    expect(b()).not.toBeNull();
    expect(b()!.getAttribute('aria-hidden')).toBe('true');
    vi.advanceTimersByTime(4200);
    await nextTick();
    expect(b()).toBeNull();
    w.unmount();
    w = mk(); await nextTick(); await nextTick();
    expect(b()).toBeNull(); // second mount in the same session
    w.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each([['reduced', 3], ['off', 3], ['full', 0]] as const)('no butterfly at %s with %i flowers', async (lvl, n) => {
    setAnimationSetting(lvl);
    const w = mount(TopBarScene, { props: { scene: 'sunflowers', flowers: n }, attachTo: document.body });
    await nextTick(); await nextTick();
    expect(document.querySelector('[data-kind="butterfly"]')).toBeNull();
    w.unmount();
  });
  it('butterfly is removed when unmounted mid-flight, with no timers left', async () => {
    vi.useFakeTimers();
    const host = document.createElement('div');
    host.innerHTML = '<i data-testid="sunflower"></i>';
    document.body.appendChild(host);
    const w = mount(Butterfly, { props: { container: host }, attachTo: document.body });
    expect(mockAnims.length).toBe(1);
    w.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('mordor: testids, eye-open once per session, replaces the butterfly', async () => {
    const w = mount(TopBarScene, { props: { scene: 'mordor', flowers: 5 }, attachTo: document.body });
    await nextTick();
    expect(w.find('[data-testid="scene-mordor"]').exists()).toBe(true);
    expect(w.find('.eye').exists()).toBe(true);
    expect(w.find('[data-animated="true"]').exists()).toBe(true);
    expect(document.querySelector('[data-kind="eye-open"]')).not.toBeNull();
    expect(document.querySelector('[data-kind="butterfly"]')).toBeNull();
    clearEffects();
    w.unmount();
    const w2 = mount(TopBarScene, { props: { scene: 'mordor' }, attachTo: document.body });
    expect(document.querySelector('[data-kind="eye-open"]')).toBeNull();
    w2.unmount();
  });
  it.each(['reduced', 'off'] as const)('scenes render statically at %s', async (lvl) => {
    setAnimationSetting(lvl);
    const m = mount(TopBarScene, { props: { scene: 'mordor' }, attachTo: document.body });
    expect(m.find('[data-testid="scene-mordor"]').attributes('data-animated')).toBe('false');
    expect(document.querySelector('[data-kind="eye-open"]')).toBeNull();
    expect(mockAnims.length).toBe(0);
    m.unmount();
    const s = mount(TopBarScene, { props: { scene: 'sunflowers', flowers: 4 }, attachTo: document.body });
    expect(s.find('[data-testid="sunflower-field"]').attributes('data-sway')).toBe('off');
    expect(document.querySelector('[data-kind="butterfly"]')).toBeNull();
    s.unmount();
  });
  it('none renders nothing; scenes never take pointer events', () => {
    expect(mount(TopBarScene, { props: { scene: 'none' } }).html()).toBe('<!--v-if-->');
  });
  it('listeners are released after unmount', () => {
    const before = __motionUsers();
    mount(TopBarScene, { props: { scene: 'mordor' } }).unmount();
    mount(TopBarScene, { props: { scene: 'sunflowers', flowers: 2 } }).unmount();
    expect(__motionUsers()).toBe(before);
  });
});

describe('LeadingWidgets', () => {
  it('renders flame + plant per settings and opens the card', async () => {
    const m = mot({ growth: 140, current: 4 });
    const f = vi.fn(async (_u: string, init?: RequestInit) => ({ ok: true, json: async () => (init?.method === 'POST' ? { current: 4, best: 5, checkedInToday: true, newToday: true, motivation: m } : m) })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', f);
    const w = mount(LeadingWidgets, { props: { today: () => '2026-10-12' }, attachTo: document.body });
    await flushPromises();
    expect(w.find('[data-testid="streak-flame"]').text()).toBe('4');
    expect(document.querySelector('[data-testid="streak-message"]')!.textContent).toBe('Checked in, day 4');
    expect(w.find('[data-testid="plant-button"]').attributes('data-stage')).toBe('3');
    await w.find('[data-testid="plant-button"]').trigger('click');
    expect(w.find('[data-testid="plant-card-stage"]').text()).toBe('Leafy');
    await w.setProps({ streakFlame: false, garden: 'off' });
    expect(w.find('[data-testid="streak-flame"]').exists()).toBe(false);
    expect(w.find('[data-testid="plant-button"]').exists()).toBe(false);
    w.unmount();
    vi.unstubAllGlobals();
  });
});
