import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { sanitizeTheme, validateTheme, type ThemeDoc } from '@calendar/shared';
import SceneImage from '@/features/motivation/SceneImage.vue';
import ThemeImport from '@/components/settings/ThemeImport.vue';
import ThemeView from '@/views/ThemeView.vue';
import { UNDO_MS, usePendingDeletesStore } from '@/stores/pendingDeletes';
import { useThemeStore } from '@/stores/theme';
import { useUiStore } from '@/stores/ui';
import { applyTheme } from '@/theme';
import { EXAMPLE_THEME, themePrompt } from '@/theme/aiPrompt';
import { docToResolved, PRESET_NAMES, presetDoc, PRESETS, resolveTheme, sanitizePref } from '@/theme/presets';
import { loadSvgSanitizer } from '@/theme/svg';
import { freshPinia, mockFetch } from './helpers';

const fixture = (name: string): ThemeDoc => JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '../../e2e/fixtures/themes', name), 'utf8'));
const tid = (id: string) => `[data-testid="${id}"]`;
const doc = (extra: object = {}) => ({ schema: 'calendar-theme/1', name: 'X', ...extra }) as ThemeDoc;

describe('theme documents', () => {
  it('expresses every preset as a valid document that resolves to the preset itself', () => {
    for (const p of Object.values(PRESETS)) {
      expect(validateTheme(presetDoc(p)).ok, p.name).toBe(true);
      const r = docToResolved(presetDoc(p));
      expect(r).toMatchObject({ name: p.name, seed: p.seed, mode: p.mode, attrs: p.attrs });
    }
    expect(PRESET_NAMES.length).toBeGreaterThan(0);
  });

  it('applies what the document leaves out as the app defaults and a picture as the custom scene', () => {
    expect(docToResolved(doc()).attrs).toEqual({ glow: 'off', entries: 'solid', corners: 'round', scene: 'none' });
    const r = docToResolved(fixture('ocean.json'));
    expect(r).toMatchObject({ name: 'Ocean', seed: '#0b6e99', mode: null, font: 'rounded', attrs: { glow: 'soft', entries: 'tinted', scene: 'custom' } });
    expect(r.sceneSvg?.dark).toContain('<svg');
  });

  it('resolves an imported theme under its overrides and falls back to Default when it is gone', () => {
    const custom = { abc: fixture('ocean.json') };
    expect(resolveTheme({ preset: 'theme:abc', overrides: { glow: 'neon' } }, '2026-10-12', custom).attrs).toMatchObject({ glow: 'neon', entries: 'tinted' });
    expect(resolveTheme({ preset: 'theme:gone', overrides: {} }, '2026-10-12', custom).name).toBe('Default');
    expect(sanitizePref({ preset: 'theme:abc' }).preset).toBe('theme:abc');
    expect(sanitizePref({ preset: 'theme:../x' }).preset).toBe('Default');
  });

  it('the AI prompt names the format, carries the schema, the rules and a valid example', () => {
    const p = themePrompt();
    expect(p).toContain('calendar-theme/1');
    expect(p).toContain('"enum":["off","soft","neon"]');
    expect(p).toMatch(/contrast ratio of at least 4\.5:1/);
    expect(p).toMatch(/must not contain script/);
    expect(p).toContain(JSON.stringify(EXAMPLE_THEME));
    expect(p.trimEnd().endsWith('wishes for the theme (replace this line with what you want, e.g. mood, colours, season, a picture for the top bar):')).toBe(true);
    expect(validateTheme(EXAMPLE_THEME).ok).toBe(true);
  });
});

describe('applyTheme', () => {
  afterEach(() => { document.getElementById('m3-dynamic-theme')?.remove(); document.documentElement.removeAttribute('style'); });

  it('puts attributes, mode, role colours and the font of a document on the page', async () => {
    const r = docToResolved(doc({ mode: 'dark', colors: { seed: '#0b6e99', dark: { primary: '#ff00aa' } }, font: 'serif', glow: 'neon' }));
    await applyTheme(r, { mode: 'light', seed: '#1a73e8' });
    const html = document.documentElement;
    expect(html.getAttribute('data-theme-name')).toBe('X');
    expect(html.getAttribute('data-glow')).toBe('neon');
    expect(html.getAttribute('data-theme')).toBe('dark');
    const css = document.getElementById('m3-dynamic-theme')!.textContent!;
    expect(css).toMatch(/:root\[data-theme="dark"\] \{[^}]*--md-sys-color-primary: #ff00aa;/);
    expect(css).not.toMatch(/:root \{[^}]*--md-sys-color-primary: #ff00aa;/);
    expect(css).toContain('--font: Georgia');
  });

  it('keeps the person\'s own mode and seed when the theme leaves them open', async () => {
    await applyTheme(docToResolved(doc()), { mode: 'light', seed: '#b3261e' });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.getElementById('m3-dynamic-theme')!.textContent).toContain('--md-sys-color-primary:');
  });
});

describe('scene SVG in the browser', () => {
  it('leaves the clean picture alone and strips everything unsafe from the sneaky one', async () => {
    const sanitize = await loadSvgSanitizer();
    const ocean = sanitize(fixture('ocean.json').scene!.svg!.light!);
    expect(ocean.removed).toBe(false);
    expect(ocean.svg).toMatch(/^<svg xmlns=/);
    const sneaky = sanitizeTheme(sanitize, fixture('sneaky.json'));
    expect(sneaky).toMatchObject({ ok: true, removed: true });
    const svg = sneaky.ok ? sneaky.doc.scene!.svg!.light! : '';
    expect(svg).not.toMatch(/script|foreignObject|<image|onload|onmouseover|example\.com|__pwned/i);
    expect(svg).toContain('<circle');
  });

  it('keeps only #fragment references in href and url()', async () => {
    const { svg, removed } = (await loadSvgSanitizer())(
      '<svg><linearGradient id="g" href="https://example.com/x#a"/><linearGradient id="h" href="#g"/><rect fill="url(https://example.com/a)"/><rect fill="url(#h)"/></svg>',
    );
    expect(removed).toBe(true);
    expect(svg).not.toContain('example.com');
    expect(svg).toContain('href="#g"');
    expect(svg).toContain('fill="url(#h)"');
  });
});

describe('SceneImage', () => {
  const svg = { light: '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="#fff"/></svg>', dark: '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="#000"/></svg>' };
  const shown = async (props: object) => {
    const w = mount(SceneImage, { props });
    await vi.waitFor(() => expect(w.find('img').exists()).toBe(true));
    return w.findAll('img').map((i) => [i.classes().join(''), decodeURIComponent(i.attributes('src')!)]);
  };

  it('renders both variants for the page theme to pick, and only as images', async () => {
    const imgs = await shown({ svg });
    expect(imgs.map((i) => i[0])).toEqual(['l', 'd']);
    expect(imgs[0]![1]).toContain('#fff');
    expect(imgs[1]![1]).toContain('#000');
  });
  it('renders the one asked for, and one image when there is no dark variant', async () => {
    expect((await shown({ svg, dark: true })).map((i) => i[1].includes('#000'))).toEqual([true]);
    expect(await shown({ svg: { light: svg.light } })).toHaveLength(1);
  });
});

describe('ThemeImport', () => {
  beforeEach(() => { freshPinia(); document.body.innerHTML = ''; });

  const open = () => mount(ThemeImport, { global: { plugins: [] }, attachTo: document.body });
  const paste = async (w: ReturnType<typeof open>, text: string) => {
    await w.get(`${tid('theme-import-text')}`).setValue(text);
    await w.get(tid('theme-import-submit')).trigger('click');
    await flushPromises();
    await vi.waitFor(() => expect(w.find(tid('theme-import-error')).exists() || w.find(tid('theme-import-preview')).exists()).toBe(true));
  };

  it('shows the prompt and copies it', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    const w = open();
    expect(w.find(tid('theme-ai-prompt')).exists()).toBe(false);
    await w.get(tid('theme-ai')).trigger('click');
    expect((w.get(tid('theme-ai-prompt')).element as HTMLTextAreaElement).value).toContain('calendar-theme/1');
    await w.get(tid('theme-ai-copy')).trigger('click');
    expect(writeText).toHaveBeenCalledWith(themePrompt());
  });

  it('refuses a broken theme in plain words and cannot save it', async () => {
    const w = open();
    await paste(w, '{"schema":"calendar-theme/1","name":"X","glow":"ultra"}');
    expect(w.findAll(tid('theme-import-error')).map((e) => e.text())).toEqual(['glow must be one of off, soft, neon']);
    expect(w.find(tid('theme-import-preview')).exists()).toBe(false);
    expect(w.get(tid('theme-import-save')).attributes('disabled')).toBeDefined();
    await paste(w, 'not json');
    expect(w.get(tid('theme-import-error')).text()).toMatch(/^This is not valid JSON/);
  });

  it('previews a valid theme without a notice, and saves and chooses it', async () => {
    const m = mockFetch({
      'POST /api/themes': ({ body }) => ({ status: 201, body: { id: 'T1', doc: body, sanitized: false } }),
      'PATCH /api/prefs/theme': ({ body }) => body,
    });
    const w = open();
    await paste(w, JSON.stringify(fixture('ocean.json')));
    expect(w.get(tid('theme-import-preview')).attributes('data-name')).toBe('Ocean');
    expect(w.find(tid('theme-import-sanitized')).exists()).toBe(false);
    expect(w.get(tid('theme-import-save')).attributes('disabled')).toBeUndefined();
    await w.get(tid('theme-import-save')).trigger('click');
    await vi.waitFor(() => expect(useThemeStore().pref.preset).toBe('theme:T1'));
    expect(m.calls.find((c) => c.path === '/api/themes')!.body.name).toBe('Ocean');
    expect(m.calls.find((c) => c.path === '/api/prefs/theme')!.body).toEqual({ preset: 'theme:T1', overrides: {} });
    expect(useThemeStore().resolved.name).toBe('Ocean');
    expect(w.find(tid('theme-import-preview')).exists()).toBe(false);
  });

  it('notes that unsafe content was removed and previews the cleaned theme', async () => {
    const w = open();
    await paste(w, JSON.stringify(fixture('sneaky.json')));
    expect(w.get(tid('theme-import-preview')).attributes('data-name')).toBe('Sneaky');
    expect(w.find(tid('theme-import-sanitized')).exists()).toBe(true);
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
  });

  it('refuses a file over 200 KB', async () => {
    const w = open();
    const input = w.get(tid('theme-import-file'));
    const big = new File(['x'.repeat(200 * 1024 + 1)], 'big.json');
    Object.defineProperty(input.element, 'files', { value: [big], configurable: true });
    await input.trigger('change');
    await flushPromises();
    expect(w.get(tid('theme-import-error')).text()).toBe('The file is larger than 200 KB');
  });

  it('reads a theme file', async () => {
    const w = open();
    const input = w.get(tid('theme-import-file'));
    Object.defineProperty(input.element, 'files', { value: [new File([JSON.stringify(fixture('ocean.json'))], 'ocean.json')], configurable: true });
    await input.trigger('change');
    await vi.waitFor(() => expect(w.find(tid('theme-import-preview')).exists()).toBe(true));
    expect(w.get(tid('theme-import-preview')).attributes('data-name')).toBe('Ocean');
  });
});

describe('imported themes in the gallery', () => {
  beforeEach(() => { vi.useFakeTimers(); freshPinia(); document.body.innerHTML = ''; });
  afterEach(() => { usePendingDeletesStore().undo(); vi.useRealTimers(); });

  async function gallery() {
    const m = mockFetch({
      'GET /api/themes': () => ({ themes: [{ id: 'T1', doc: fixture('ocean.json') }] }),
      'GET /api/prefs/theme': () => ({ preset: 'Default', overrides: {} }),
      'DELETE /api/themes/T1': () => ({ status: 204 }),
    });
    await useThemeStore().load();
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: ThemeView }, { path: '/settings', component: { template: '<i/>' } }] });
    await router.push('/');
    const w = mount(ThemeView, { global: { plugins: [router] }, attachTo: document.body });
    await flushPromises();
    return { w, m };
  }
  const names = (w: Awaited<ReturnType<typeof gallery>>['w']) => w.findAll(tid('theme-card')).map((c) => c.attributes('data-name'));

  it('offers the theme next to the presets and deletes it with an undo', async () => {
    const { w, m } = await gallery();
    expect(names(w)).toEqual([...PRESET_NAMES, 'Ocean']);
    expect(w.findAll(tid('theme-delete'))).toHaveLength(1);
    await w.get(tid('theme-delete')).trigger('click');
    expect(names(w)).not.toContain('Ocean');
    expect(useUiStore().snackbars.find((s) => s.testid === 'undo-snackbar')?.text).toBe('Deleted: Ocean');
    usePendingDeletesStore().undo();
    await flushPromises();
    expect(names(w)).toContain('Ocean');
    await w.get(tid('theme-delete')).trigger('click');
    vi.advanceTimersByTime(UNDO_MS);
    await flushPromises();
    expect(m.calls.filter((c) => c.method === 'DELETE').map((c) => c.path)).toEqual(['/api/themes/T1']);
    expect(names(w)).not.toContain('Ocean');
  });

  it('chooses the imported theme from its card', async () => {
    const { w, m } = await gallery();
    mockFetch({ 'PATCH /api/prefs/theme': ({ body }) => body });
    await w.get('[data-testid="theme-card"][data-name="Ocean"]').trigger('click');
    expect(useThemeStore().pref.preset).toBe('theme:T1');
    expect(m).toBeDefined();
  });

  it('exports the theme document as a file', async () => {
    const { w } = await gallery();
    const blobs: Blob[] = [];
    URL.createObjectURL = (b: Blob | MediaSource) => { blobs.push(b as Blob); return 'blob:x'; };
    URL.revokeObjectURL = () => undefined;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    await w.get(tid('theme-export')).trigger('click');
    expect(click).toHaveBeenCalled();
    expect(JSON.parse(await blobs[0]!.text())).toEqual(fixture('ocean.json'));
  });
});
