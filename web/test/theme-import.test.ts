import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { sanitizePicture, validateTheme, type ThemeDoc } from '@calendar/shared';
import DrawnScene from '@/features/motivation/DrawnScene.vue';
import { DENSITY_COUNT, drawDecor } from '@/features/motivation/drawnScene';
import SceneImage from '@/features/motivation/SceneImage.vue';
import ThemeImport from '@/components/settings/ThemeImport.vue';
import ThemeView from '@/views/ThemeView.vue';
import { UNDO_MS, usePendingDeletesStore } from '@/stores/pendingDeletes';
import { usePrefsStore } from '@/stores/prefs';
import { useSettingsStore } from '@/stores/settings';
import { useThemeStore } from '@/stores/theme';
import { useUiStore } from '@/stores/ui';
import { applyTheme } from '@/theme';
import { EXAMPLE_THEME, themePrompt } from '@/theme/aiPrompt';
import { t } from '@/i18n';
import { cleanAiText, repairPrompt } from '@/theme/importText';
import { docToResolved, PRESET_NAMES, presetDoc, PRESETS, resolveTheme, sanitizePref } from '@/theme/presets';
import { DEFAULT_THEME_NAME, lookToDoc, uniqueName } from '@/theme/saveLook';
import { loadSvgSanitizer } from '@/theme/svg';
import { freshPinia, mockFetch, settingsFixture, type Handler } from './helpers';

const dir = path.join(import.meta.dirname, '../../e2e/fixtures/themes');
const read = (name: string) => fs.readFileSync(path.join(dir, name), 'utf8');
const ocean = (): ThemeDoc => JSON.parse(read('ocean.json'));
const sneaky = () => read('sneaky.svg');
const tid = (id: string) => `[data-testid="${id}"]`;
const doc = (extra: object = {}) => ({ schema: 'calendar-theme/2', name: 'X', ...extra }) as ThemeDoc;

describe('theme documents', () => {
  it('expresses every preset as a valid document that resolves to the preset itself', () => {
    for (const p of Object.values(PRESETS)) {
      expect(validateTheme(presetDoc(p)).ok, p.name).toBe(true);
      expect(docToResolved(presetDoc(p))).toMatchObject({ name: p.name, seed: p.seed, mode: p.mode, attrs: p.attrs });
    }
    expect(PRESETS.Default.attrs.scene).toBe('none');
  });

  it('applies what the document leaves out as the app defaults', () => {
    expect(docToResolved(doc()).attrs).toEqual({ glow: 'off', entries: 'solid', corners: 'round', scene: 'none' });
  });

  it('turns a gradient scene into a drawn custom scene and an own picture into the custom picture', () => {
    const r = docToResolved(ocean());
    expect(r).toMatchObject({ name: 'Ocean', seed: '#0b6e99', mode: null, font: 'rounded', attrs: { glow: 'soft', entries: 'tinted', scene: 'custom' } });
    expect(r.sceneDraw).toEqual({ gradient: ['#8fd3f0', '#2b8fb8', '#0b6e99'], decor: 'waves', density: 'medium' });
    expect(r.sceneSvg).toBeUndefined();
    const withPicture = docToResolved(ocean(), { light: '<svg/>' });
    expect(withPicture.sceneSvg).toEqual({ light: '<svg/>' });
    expect(withPicture.attrs.scene).toBe('custom');
    expect(docToResolved(doc({ scene: { builtin: 'mordor' } })).attrs.scene).toBe('mordor');
  });

  it('resolves an own theme under its overrides and falls back to Default when it is gone', () => {
    const custom = { abc: { doc: ocean() } };
    expect(resolveTheme({ preset: 'theme:abc', overrides: { glow: 'neon' }, seasonal: 'off' }, '2026-10-12', custom).attrs).toMatchObject({ glow: 'neon', entries: 'tinted' });
    expect(resolveTheme({ preset: 'theme:gone', overrides: {}, seasonal: 'off' }, '2026-10-12', custom).name).toBe('Default');
    expect(sanitizePref({ preset: 'theme:abc' }).preset).toBe('theme:abc');
    expect(sanitizePref({ preset: 'theme:../x' }).preset).toBe('Default');
  });
});

describe('the AI prompt', () => {
  it('is short, names the format, carries the schema, the decor options and a valid example, and asks for JSON only', () => {
    const p = themePrompt();
    expect(p.length).toBeLessThan(6000);
    expect(p).toContain('calendar-theme/2');
    expect(p).toContain('only the JSON in one code block');
    expect(p).toContain('no SVG');
    expect(p).toContain('"enum":["off","soft","neon"]');
    expect(p).toContain('stars, sparkles, waves, hills, hearts, clouds, confetti, bubbles');
    expect(p).toMatch(/contrast ratio of at least 4\.5:1/);
    expect(p).toContain(JSON.stringify(EXAMPLE_THEME));
    expect(p.trimEnd().endsWith('(replace this line with what you want, e.g. mood, colours, season):')).toBe(true);
    expect(validateTheme(EXAMPLE_THEME).ok).toBe(true);
  });
});

describe('tidying an AI answer', () => {
  it('takes the fenced block of a chat answer and turns Markdown links back into URLs', () => {
    const json = JSON.parse(cleanAiText(read('gemini-answer.txt')));
    expect(json.description).toBe('Turquoise lagoon, see http://example.com/lagoon');
    expect(validateTheme(json).ok).toBe(true);
  });
  it('leaves clean JSON alone and drops text around it', () => {
    expect(cleanAiText('{"a": 1}')).toBe('{"a": 1}');
    expect(cleanAiText('Here you go: {"a": 1} Enjoy!')).toBe('{"a": 1}');
    expect(cleanAiText('```\n{"a": [1]}\n```')).toBe('{"a": [1]}');
  });
  it('writes a repair prompt with the problems and the text', () => {
    const p = repairPrompt('{"x": 1}', ['glow must be one of off, soft, neon']);
    expect(p).toContain('- glow must be one of off, soft, neon');
    expect(p).toContain('{"x": 1}');
    expect(p).toContain('only the corrected JSON in one code block');
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

describe('own picture in the browser', () => {
  it('strips everything unsafe from the sneaky picture', async () => {
    const sanitize = await loadSvgSanitizer();
    const r = sanitizePicture(sanitize, { light: sneaky() });
    expect(r).toMatchObject({ ok: true, removed: true });
    const svg = r.ok ? r.picture.light! : '';
    expect(svg).not.toMatch(/script|foreignObject|<image|onload|onmouseover|example\.com|__pwned/i);
    expect(svg).toContain('<circle');
    expect(sanitize('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>').removed).toBe(false);
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

describe('drawn scene', () => {
  it('draws every decor, the more the denser, the same way every time', () => {
    for (const decor of ['stars', 'sparkles', 'waves', 'hills', 'hearts', 'clouds', 'confetti', 'bubbles'] as const) {
      const low = drawDecor(decor, 'low', ['#112233', '#445566']);
      const high = drawDecor(decor, 'high', ['#112233', '#445566']);
      expect(low.length, decor).toBeGreaterThan(0);
      expect(high.length, decor).toBeGreaterThan(low.length);
      expect(drawDecor(decor, 'low', ['#112233', '#445566'])).toEqual(low);
    }
    expect(drawDecor('stars', 'medium', ['#000000', '#111111'])).toHaveLength(DENSITY_COUNT.medium);
    expect(drawDecor('waves', 'high', ['#000000', '#111111'])).toHaveLength(3);
  });

  it('renders the gradient and the chosen decor as shapes, and dims for dark', () => {
    const w = mount(DrawnScene, { props: { gradient: ['#111111', '#222222'], decor: 'stars', density: 'low' } });
    expect(w.get(tid('drawn-scene')).attributes('data-decor')).toBe('stars');
    expect(w.get(tid('drawn-scene')).attributes('style')).toContain('linear-gradient');
    expect(w.findAll('circle')).toHaveLength(DENSITY_COUNT.low);
    expect(w.get(tid('drawn-scene')).attributes('data-dark')).toBeUndefined();
    expect(mount(DrawnScene, { props: { gradient: ['#111111', '#222222'], dark: true } }).get(tid('drawn-scene')).attributes('data-dark')).toBe('true');
    expect(mount(DrawnScene, { props: { gradient: ['#111111', '#222222'] } }).find('svg').exists()).toBe(false);
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

describe('saving the look as my own theme', () => {
  const own = { mode: 'system' as const, seed: '#1A73E8' };
  it('writes the chosen theme with the fine-tuning, mode, seed and font as a valid document', () => {
    const r = resolveTheme({ preset: 'Neon', overrides: { glow: 'soft' }, seasonal: 'off' }, '2026-10-12');
    const { doc: d, picture } = lookToDoc(r, own, 'Night');
    expect(d).toMatchObject({ schema: 'calendar-theme/2', name: 'Night', mode: 'dark', colors: { seed: '#9d4dff' }, glow: 'soft', entries: 'outline', corners: 'pill', scene: { builtin: 'none' } });
    expect(picture).toBeUndefined();
    expect(validateTheme(d).ok).toBe(true);
    const own2 = lookToDoc(resolveTheme({ preset: 'Default', overrides: {}, seasonal: 'off' }, '2026-10-12'), own, 'D').doc;
    expect(own2).toMatchObject({ mode: 'follow', colors: { seed: '#1a73e8' } });
  });
  it('keeps a drawn scene, the font, role colours and an own picture', () => {
    const d = doc({ colors: { seed: '#0b6e99', dark: { primary: '#ff00aa' } }, font: 'mono', scene: { gradient: ['#111111', '#222222'], decor: 'hills', density: 'high' } });
    const saved = lookToDoc(docToResolved(d, { light: '<svg/>' }), own, 'Mine');
    expect(saved.doc).toMatchObject({ font: 'mono', colors: { seed: '#0b6e99', dark: { primary: '#ff00aa' } }, scene: { gradient: ['#111111', '#222222'], decor: 'hills', density: 'high' } });
    expect(saved.picture).toEqual({ light: '<svg/>' });
    expect(validateTheme(saved.doc).ok).toBe(true);
  });
  it('saves a scene override instead of the own scene, and numbers a name that is taken', () => {
    const r = resolveTheme({ preset: 'theme:a', overrides: { scene: 'mordor' }, seasonal: 'off' }, '2026-10-12', { a: { doc: ocean() } });
    expect(lookToDoc(r, own, 'M').doc.scene).toEqual({ builtin: 'mordor' });
    expect(uniqueName(DEFAULT_THEME_NAME, [])).toBe('My theme');
    expect(uniqueName(DEFAULT_THEME_NAME, ['My theme', 'My theme 2'])).toBe('My theme 3');
  });
});

describe('ThemeImport', () => {
  beforeEach(() => { localStorage.clear(); freshPinia(); document.body.innerHTML = ''; });

  const open = (ai = false) => mount(ThemeImport, { props: { ai }, attachTo: document.body });
  const settle = async (w: ReturnType<typeof open>) => {
    await flushPromises();
    await vi.waitFor(() => expect(w.find(tid('theme-import-error')).exists() || w.find(tid('theme-import-preview')).exists()).toBe(true));
  };
  const paste = async (w: ReturnType<typeof open>, text: string) => {
    await w.get(tid('theme-import-text')).setValue(text);
    await w.get(tid('theme-import-submit')).trigger('click');
    await settle(w);
  };
  const errors = (w: ReturnType<typeof open>) => w.findAll(tid('theme-import-error')).map((e) => e.text());
  const pick = async (w: ReturnType<typeof open>, testid: string, file: File) => {
    const input = w.get(tid(testid));
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true });
    await input.trigger('change');
    await flushPromises();
  };

  it('shows the prompt and copies it', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    expect(open().find(tid('theme-ai')).exists()).toBe(false);
    const w = open(true);
    expect(w.find(tid('theme-ai-prompt')).exists()).toBe(false);
    await w.get(tid('theme-ai')).trigger('click');
    expect((w.get(tid('theme-ai-prompt')).element as HTMLTextAreaElement).value).toContain('calendar-theme/2');
    await w.get(tid('theme-ai-copy')).trigger('click');
    expect(writeText).toHaveBeenCalledWith(themePrompt());
  });

  it('refuses a broken theme in plain words, cannot save it and offers a repair prompt', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    const w = open(true);
    expect(w.find(tid('theme-repair-copy')).exists()).toBe(false);
    await paste(w, '{"schema":"calendar-theme/2","name":"X","glow":"ultra"}');
    expect(errors(w)).toEqual(['glow must be one of off, soft, neon']);
    expect(w.find(tid('theme-import-preview')).exists()).toBe(false);
    expect(w.get(tid('theme-import-save')).attributes('disabled')).toBeDefined();
    const shown = (w.get(tid('theme-repair-prompt')).element as HTMLTextAreaElement).value;
    expect(shown).toContain('- glow must be one of off, soft, neon');
    await w.get(tid('theme-repair-copy')).trigger('click');
    expect(writeText).toHaveBeenCalledWith(shown);
  });

  it('gives a hint and a repair prompt for text that is not JSON', async () => {
    const w = open(true);
    await paste(w, 'Sure! {"name": "X", }');
    expect(errors(w)[0]).toBe(t('theme.import.notJson'));
    expect(w.find(tid('theme-repair-copy')).exists()).toBe(true);
    const plain = open();
    await paste(plain, 'Sure! {"name": "X", }');
    expect(errors(plain)[0]).toBe(t('theme.import.notJson'));
    expect(plain.find(tid('theme-repair-copy')).exists()).toBe(false);
  });

  it('imports an AI chat answer with a code fence and Markdown links', async () => {
    const w = open();
    await paste(w, read('gemini-answer.txt'));
    expect(errors(w)).toEqual([]);
    expect(w.get(tid('theme-import-preview')).attributes('data-name')).toBe('Lagoon');
  });

  it('previews a valid theme without a notice, and saves and chooses it', async () => {
    const m = mockFetch({
      'POST /api/themes': ({ body }) => ({ status: 201, body: { id: 'T1', doc: body.theme, sanitized: false } }),
      'PATCH /api/prefs/theme': ({ body }) => body,
    });
    useThemeStore().pref = { preset: 'Default', overrides: {}, seasonal: 'off' };
    const w = open();
    await paste(w, JSON.stringify(ocean()));
    expect(w.get(tid('theme-import-preview')).attributes('data-name')).toBe('Ocean');
    expect(w.find(tid('theme-import-sanitized')).exists()).toBe(false);
    expect(w.get(tid('theme-import-save')).attributes('disabled')).toBeUndefined();
    await w.get(tid('theme-import-save')).trigger('click');
    await vi.waitFor(() => expect(useThemeStore().pref.preset).toBe('theme:T1'));
    expect(m.calls.find((c) => c.path === '/api/themes')!.body).toEqual({ theme: ocean() });
    expect(m.calls.find((c) => c.path === '/api/prefs/theme')!.body).toEqual({ preset: 'theme:T1', overrides: {}, seasonal: 'off' });
    expect(useThemeStore().resolved.name).toBe('Ocean');
    expect(w.find(tid('theme-import-preview')).exists()).toBe(false);
  });

  it('adds an own picture, sanitised, with a notice, and sends it next to the document', async () => {
    const m = mockFetch({
      'POST /api/themes': ({ body }) => ({ status: 201, body: { id: 'T1', doc: body.theme, picture: body.picture, sanitized: true } }),
      'PATCH /api/prefs/theme': ({ body }) => body,
    });
    useThemeStore().pref = { preset: 'Default', overrides: {}, seasonal: 'off' };
    const w = open();
    await w.get(tid('theme-import-text')).setValue(JSON.stringify(ocean()));
    await pick(w, 'theme-picture-file', new File([sneaky()], 'sneaky.svg'));
    await settle(w);
    expect(w.get(tid('theme-import-preview')).attributes('data-name')).toBe('Ocean');
    expect(w.find(tid('theme-import-sanitized')).exists()).toBe(true);
    expect(w.find(tid('scene-image')).exists() || w.find(tid('drawn-scene')).exists()).toBe(true);
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
    await w.get(tid('theme-import-save')).trigger('click');
    await vi.waitFor(() => expect(useThemeStore().pref.preset).toBe('theme:T1'));
    const sent = m.calls.find((c) => c.path === '/api/themes')!.body;
    expect(sent.picture.light).toMatch(/^<svg /);
    expect(sent.picture.light).not.toMatch(/script|onload|example\.com/);
    expect(useThemeStore().resolved.sceneSvg?.light).toBe(sent.picture.light);
    expect(useThemeStore().resolved.attrs.scene).toBe('custom');
  });

  it('refuses a picture that is not an SVG, and files over their size limit', async () => {
    const w = open();
    await w.get(tid('theme-import-text')).setValue(JSON.stringify(ocean()));
    await pick(w, 'theme-picture-file', new File(['hello'], 'x.svg'));
    await settle(w);
    expect(errors(w)).toEqual(['picture.light must be an SVG picture (starting with <svg)']);
    expect(w.find(tid('theme-repair-copy')).exists()).toBe(false);
    await pick(w, 'theme-picture-file', new File(['x'.repeat(100 * 1024 + 1)], 'big.svg'));
    expect(errors(w)).toEqual(['The picture is larger than 100 KB']);
    await pick(w, 'theme-import-file', new File(['x'.repeat(200 * 1024 + 1)], 'big.json'));
    expect(errors(w)).toEqual(['The file is larger than 200 KB']);
  });

  it('reads a theme file', async () => {
    const w = open();
    await pick(w, 'theme-import-file', new File([JSON.stringify(ocean())], 'ocean.json'));
    await vi.waitFor(() => expect(w.find(tid('theme-import-preview')).exists()).toBe(true));
    expect(w.get(tid('theme-import-preview')).attributes('data-name')).toBe('Ocean');
  });
});

describe('own themes in the theme menu', () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); freshPinia(); document.body.innerHTML = ''; });
  afterEach(() => { usePendingDeletesStore().undo(); vi.useRealTimers(); });

  async function menu(extra: Record<string, Handler> = {}) {
    const m = mockFetch({
      'GET /api/themes': () => ({ themes: [{ id: 'T1', doc: ocean() }] }),
      'GET /api/prefs/theme': () => ({ preset: 'Default', overrides: {} }),
      'DELETE /api/themes/T1': () => ({ status: 204 }),
      ...extra,
    });
    await useThemeStore().load();
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: ThemeView }, { path: '/settings', component: { template: '<i/>' } }] });
    await router.push('/');
    const w = mount(ThemeView, { global: { plugins: [router] }, attachTo: document.body });
    await flushPromises();
    return { w, m };
  }
  const names = (w: Awaited<ReturnType<typeof menu>>['w']) => w.findAll(tid('theme-card')).map((c) => c.attributes('data-name'));

  it('always offers saved themes and the import, and the AI prompt only with Labs on and the AI switch', async () => {
    const { w } = await menu();
    expect(names(w)).toEqual([...PRESET_NAMES, 'Ocean']);
    expect(w.find(tid('theme-own')).exists()).toBe(true);
    expect(w.find(tid('theme-ai')).exists()).toBe(false);
    usePrefsStore().labsOwnThemes = true;
    await flushPromises();
    expect(w.find(tid('theme-ai')).exists()).toBe(false);
    usePrefsStore().labs = true;
    await flushPromises();
    expect(w.find(tid('theme-ai')).exists()).toBe(true);
    expect(w.find(tid('theme-save-own')).exists()).toBe(true);
  });

  it('asks for the saved themes and the choice together, not one after the other', async () => {
    let release: () => void = () => {};
    const held = new Promise<void>((r) => { release = r; });
    const m = mockFetch({
      'GET /api/themes': async () => { await held; return { themes: [{ id: 'T1', doc: ocean() }] }; },
      'GET /api/prefs/theme': () => ({ preset: 'theme:T1', overrides: {} }),
    });
    const loading = useThemeStore().load();
    await flushPromises();
    // the choice was requested while the (held) themes request was still open
    expect(m.calls.map((c) => c.path).sort()).toEqual(['/api/prefs/theme', '/api/themes']);
    release();
    await loading;
    expect(useThemeStore().resolved.name).toBe('Ocean');
  });

  it('applies a chosen own theme with the Labs switch off', async () => {
    mockFetch({ 'GET /api/themes': () => ({ themes: [{ id: 'T1', doc: ocean() }] }), 'GET /api/prefs/theme': () => ({ preset: 'theme:T1', overrides: {} }) });
    await useThemeStore().load();
    expect(usePrefsStore().labsOwnThemes).toBe(false);
    expect(useThemeStore().resolved.name).toBe('Ocean');
  });

  it('deletes with an undo', async () => {
    const { w, m } = await menu();
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

  it('chooses an own theme from its card', async () => {
    const { w } = await menu({ 'PATCH /api/prefs/theme': ({ body }) => body });
    await w.get('[data-testid="theme-card"][data-name="Ocean"]').trigger('click');
    expect(useThemeStore().pref.preset).toBe('theme:T1');
  });

  it('exports the theme document as a file', async () => {
    const { w } = await menu();
    const blobs: Blob[] = [];
    URL.createObjectURL = (b: Blob | MediaSource) => { blobs.push(b as Blob); return 'blob:x'; };
    URL.revokeObjectURL = () => undefined;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    await w.get(tid('theme-export')).trigger('click');
    expect(click).toHaveBeenCalled();
    expect(JSON.parse(await blobs[0]!.text())).toEqual(ocean());
  });

  it('saves the fine-tuned look as an own theme under a name, and chooses it', async () => {
    const m = mockFetch({
      'GET /api/themes': () => ({ themes: [] }),
      'GET /api/prefs/theme': () => ({ preset: 'Neon', overrides: { glow: 'soft' } }),
      'POST /api/themes': ({ body }) => ({ status: 201, body: { id: 'N1', doc: body.theme, sanitized: false } }),
      'PATCH /api/prefs/theme': ({ body }) => body,
    });
    useSettingsStore().settings = settingsFixture();
    await useThemeStore().load();
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: ThemeView }, { path: '/settings', component: { template: '<i/>' } }] });
    await router.push('/');
    const w = mount(ThemeView, { global: { plugins: [router] }, attachTo: document.body });
    await flushPromises();
    await w.get(tid('theme-save-own')).trigger('click');
    const name = document.querySelector<HTMLInputElement>(tid('theme-save-name'))!;
    expect(name.value).toBe('My theme');
    name.value = '';
    name.dispatchEvent(new Event('input'));
    document.querySelector<HTMLButtonElement>(tid('theme-save-confirm'))!.click();
    await flushPromises();
    expect(document.querySelector(tid('theme-save-error'))?.textContent).toBe('Name is required');
    name.value = 'Night';
    name.dispatchEvent(new Event('input'));
    document.querySelector<HTMLButtonElement>(tid('theme-save-confirm'))!.click();
    await vi.waitFor(() => expect(m.calls.some((c) => c.method === 'PATCH' && c.path === '/api/prefs/theme')).toBe(true));
    const sent = m.calls.find((c) => c.method === 'POST' && c.path === '/api/themes')!.body.theme;
    expect(sent).toMatchObject({ name: 'Night', mode: 'dark', glow: 'soft', entries: 'outline', corners: 'pill', colors: { seed: '#9d4dff' } });
    expect(m.calls.find((c) => c.method === 'PATCH' && c.path === '/api/prefs/theme')!.body).toEqual({ preset: 'theme:N1', overrides: {}, seasonal: 'off' });
    expect(document.querySelector(tid('theme-save-dialog'))).toBeNull();
  });
});
