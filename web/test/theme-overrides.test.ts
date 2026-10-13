import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { SEED_PRESETS } from '@/api/colors';
import ThemeView from '@/views/ThemeView.vue';
import { useSettingsStore } from '@/stores/settings';
import { useThemeStore } from '@/stores/theme';
import { resolveTheme, sanitizePref } from '@/theme/presets';
import { freshPinia, mockFetch, settingsFixture } from './helpers';

const tid = (id: string) => `[data-testid="${id}"]`;
const GREEN = SEED_PRESETS.find((p) => p.name === 'Green')!.hex;

describe('The seed colour is fine-tuning on top of the chosen preset', () => {
  beforeEach(() => { localStorage.clear(); freshPinia(); document.body.innerHTML = ''; });

  async function menu(pref: object) {
    const m = mockFetch({
      'GET /api/themes': () => ({ themes: [] }),
      'GET /api/prefs/theme': () => pref,
      'PATCH /api/prefs/theme': ({ body }) => body,
      'PATCH /api/settings': ({ body }) => settingsFixture({ ...body, version: 2 }),
    });
    useSettingsStore().settings = settingsFixture();
    await useThemeStore().load();
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: ThemeView }, { path: '/settings', component: { template: '<i/>' } }] });
    await router.push('/');
    const w = mount(ThemeView, { global: { plugins: [router] }, attachTo: document.body });
    await flushPromises();
    return { w, m };
  }

  it('a seed colour picked over Neon is the colour in use, with Neon\'s other settings', async () => {
    const { w } = await menu({ preset: 'Neon', overrides: {} });
    expect(useThemeStore().resolved.seed).toBe('#9d4dff');
    await w.get(`${tid('settings-seed-preset')}[data-name="Green"]`).trigger('click');
    await flushPromises();
    expect(useThemeStore().resolved).toMatchObject({ seed: GREEN, mode: 'dark', attrs: { glow: 'neon', entries: 'outline', corners: 'pill' } });
  });

  it('choosing the preset again gives its own colour back', async () => {
    const { w } = await menu({ preset: 'Neon', overrides: { seed: GREEN, glow: 'soft' } });
    expect(useThemeStore().resolved).toMatchObject({ seed: GREEN, attrs: { glow: 'soft' } });
    await w.get('[data-testid="theme-card"][data-name="Neon"]').trigger('click');
    await flushPromises();
    expect(useThemeStore().resolved).toMatchObject({ seed: '#9d4dff', mode: 'dark', attrs: { glow: 'neon' } });
  });

  it('the swatches show the colour in use, not the stored setting', async () => {
    const { w } = await menu({ preset: 'Neon', overrides: { seed: GREEN } });
    expect(w.get(`${tid('settings-seed-preset')}[data-name="Green"]`).attributes('aria-pressed')).toBe('true');
  });

  it('leaves the person\'s own seed setting as the base where the preset has none, and keeps only valid overrides', () => {
    expect(resolveTheme({ preset: 'Default', overrides: {} }, '2026-10-12')).toMatchObject({ seed: null, mode: null });
    expect(resolveTheme({ preset: 'Default', overrides: { seed: GREEN } }, '2026-10-12')).toMatchObject({ seed: GREEN, mode: null });
    expect(sanitizePref({ preset: 'Neon', overrides: { seed: 'green', mode: 'dark', glow: 'soft' } }).overrides).toEqual({ glow: 'soft' });
  });
});
