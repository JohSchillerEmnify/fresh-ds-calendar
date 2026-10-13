import { beforeEach, describe, expect, it } from 'vitest';
import { applyAttrs } from '@/theme';
import {
  DENSITY_SCALE, fineVars, glowVars, GLOW_STEPS, radiusVars, RADIUS_STEPS, sanitizeFine, sliderText, stepOf,
} from '@/theme/fine';
import { docToResolved, presetDoc, PRESETS, resolveTheme, sanitizePref } from '@/theme/presets';
import { lookToDoc } from '@/theme/saveLook';
import { useThemeStore } from '@/stores/theme';
import { freshPinia, mockFetch } from './helpers';

const TODAY = '2026-10-12';

describe('step and slider value', () => {
  it('maps every step to its value and back, and tells a value between steps', () => {
    expect(GLOW_STEPS).toEqual({ off: 0, soft: 40, neon: 100 });
    expect(RADIUS_STEPS).toEqual({ square: 2, round: 6, pill: 28 });
    expect(stepOf(GLOW_STEPS, 40)).toBe('soft');
    expect(stepOf(GLOW_STEPS, 70)).toBeNull();
    expect(stepOf(RADIUS_STEPS, 28)).toBe('pill');
    expect(stepOf(RADIUS_STEPS, 4)).toBeNull();
  });

  it('draws the old steps exactly at their values and interpolates between', () => {
    expect(glowVars(0)).toMatchObject({ '--glow-r': '0px', '--glow-a': '0%', '--glow-anim': 'initial' });
    expect(glowVars(40)).toEqual({ '--glow-r': '9px', '--glow-s': '0px', '--glow-a': '55%', '--glow-anim': 'initial' });
    expect(glowVars(100)).toEqual({ '--glow-r': '14px', '--glow-s': '2px', '--glow-a': '95%', '--glow-anim': 'neon-pulse' });
    expect(glowVars(70)).toMatchObject({ '--glow-r': '11.5px', '--glow-a': '75%', '--glow-anim': 'initial' });
    expect(glowVars(150)).toMatchObject({ '--glow-r': '20px', '--glow-s': '4px' });
    expect(radiusVars(2)).toEqual({ '--r-chip': '2px', '--r-block': '2px' });
    expect(radiusVars(6)).toEqual({ '--r-chip': '6px', '--r-block': '8px' });
    expect(radiusVars(4)).toEqual({ '--r-chip': '4px', '--r-block': '5px' });
    expect(radiusVars(0)).toEqual({ '--r-chip': '0px', '--r-block': '0px' });
    expect(radiusVars(28)).toEqual({ '--r-chip': '999px', '--r-block': '16px' });
  });

  it('uses the tint only for tinted entries, and scales the font by density', () => {
    expect(fineVars({ tint: 30 }, 'tinted')).toEqual({ '--e-fill': '30%' });
    expect(fineVars({ tint: 30 }, 'solid')).toEqual({});
    expect(fineVars({ density: 'compact' }, 'solid')).toEqual({ '--dz': '0.9' });
    expect(fineVars({}, 'tinted')).toEqual({});
    expect(DENSITY_SCALE).toEqual({ compact: 0.9, comfortable: 1, airy: 1.12 });
  });

  it('shows the value with its unit', () => {
    expect([sliderText('radius', 4), sliderText('tint', 30), sliderText('glowStrength', 70)]).toEqual(['4 px', '30 %', '70']);
  });
});

describe('sanitising', () => {
  it('keeps valid values and drops out-of-range, fractional, wrongly typed and unknown ones', () => {
    expect(sanitizeFine({ glowStrength: 150, radius: 0, tint: 5, density: 'airy', checkbox: 'square', checkFill: 'outline', check: 'dot' }))
      .toEqual({ glowStrength: 150, radius: 0, tint: 5, density: 'airy', checkbox: 'square', checkFill: 'outline', check: 'dot' });
    expect(sanitizeFine({ glowStrength: 151, radius: -1, tint: 4, density: 'tiny', checkbox: 'star', check: 'x', checkFill: 1 })).toEqual({});
    expect(sanitizeFine({ radius: 4.5, tint: '30', glowStrength: null })).toEqual({});
    expect(sanitizeFine(undefined)).toEqual({});
  });

  it('lets only valid fine-tuning through a stored preference', () => {
    expect(sanitizePref({ preset: 'Neon', overrides: { glow: 'soft', radius: 4, tint: 99, density: 'compact', icons: 'filled' } }).overrides)
      .toEqual({ glow: 'soft', radius: 4, density: 'compact' });
  });
});

describe('resolving', () => {
  it('takes fine-tuning from overrides on top of the theme', () => {
    const r = resolveTheme({ preset: 'Neon', overrides: { radius: 4, check: 'cross' } }, TODAY);
    expect(r.fine).toEqual({ radius: 4, check: 'cross' });
    expect(r.attrs.corners).toBe('pill');
  });

  it('lets a picked step win over the own number of an imported theme', () => {
    const doc = { ...presetDoc(PRESETS.Neon), glowStrength: 70, radius: 4 };
    const custom = { x: { doc } };
    expect(resolveTheme({ preset: 'theme:x', overrides: {} }, TODAY, custom).fine).toEqual({ glowStrength: 70, radius: 4 });
    expect(resolveTheme({ preset: 'theme:x', overrides: { glow: 'soft' } }, TODAY, custom).fine).toEqual({ radius: 4 });
    expect(resolveTheme({ preset: 'theme:x', overrides: { glow: 'soft', glowStrength: 40 } }, TODAY, custom).fine).toEqual({ glowStrength: 40, radius: 4 });
  });

  it('writes the fine-tuning into a saved theme and reads it back', () => {
    const r = resolveTheme({ preset: 'Default', overrides: { glowStrength: 70, radius: 4, tint: 30, density: 'compact', checkbox: 'square', check: 'cross' } }, TODAY);
    const { doc } = lookToDoc(r, { mode: 'light', seed: '#1a73e8' }, 'Fine');
    expect(doc).toMatchObject({ glowStrength: 70, radius: 4, tint: 30, density: 'compact', checkbox: 'square', check: 'cross' });
    expect(docToResolved(doc).fine).toEqual(r.fine);
  });
});

describe('applying', () => {
  beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute('style'); });

  it('sets the custom properties and checkbox attributes, and removes them when the value is gone', () => {
    const root = document.documentElement;
    applyAttrs(resolveTheme({ preset: 'Default', overrides: { radius: 4, check: 'cross', checkbox: 'square' } }, TODAY), root);
    expect(root.style.getPropertyValue('--r-chip')).toBe('4px');
    expect([root.dataset.check, root.dataset.checkbox, root.dataset.checkfill]).toEqual(['cross', 'square', 'filled']);
    expect(localStorage.getItem('cal.themeFine')).toContain('--r-block:5px');
    applyAttrs(resolveTheme({ preset: 'Default', overrides: {} }, TODAY), root);
    expect(root.style.getPropertyValue('--r-chip')).toBe('');
    expect(root.dataset.check).toBe('tick');
    expect(localStorage.getItem('cal.themeFine')).toBe('');
  });
});

describe('store', () => {
  beforeEach(() => { localStorage.clear(); freshPinia(); });

  it('resets all fine-tuning when a preset is chosen, and saves a slider move once', async () => {
    const m = mockFetch({ 'PATCH /api/prefs/theme': ({ body }) => body });
    const t = useThemeStore();
    t.preview({ radius: 3 });
    t.preview({ radius: 4 });
    expect(m.calls).toHaveLength(0);
    await t.pickMany({ radius: 4, density: 'compact', glow: 'soft', glowStrength: 40 });
    expect(m.calls).toHaveLength(1);
    expect(t.pref.overrides).toEqual({ radius: 4, density: 'compact', glow: 'soft', glowStrength: 40 });
    expect(t.resolved.fine).toEqual({ radius: 4, density: 'compact', glowStrength: 40 });
    await t.choose('Neon');
    expect(t.pref).toEqual({ preset: 'Neon', overrides: {} });
    expect(t.resolved.fine).toEqual({});
  });
});

describe('icon set', () => {
  beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute('style'); });

  it('is an override that is validated, applied to <html> and the reactive value, and reset by a preset', async () => {
    const { iconSet } = await import('@/theme/iconSet');
    expect(sanitizeFine({ icons: 'sharp' })).toEqual({ icons: 'sharp' });
    expect(sanitizeFine({ icons: 'filled' })).toEqual({});
    const root = document.documentElement;
    applyAttrs(resolveTheme({ preset: 'Default', overrides: { icons: 'sharp' } }, TODAY), root);
    expect([root.dataset.icons, iconSet.value]).toEqual(['sharp', 'sharp']);
    expect(JSON.parse(localStorage.getItem('cal.themeAttrs')!).icons).toBe('sharp');
    applyAttrs(resolveTheme({ preset: 'Default', overrides: {} }, TODAY), root);
    expect([root.dataset.icons, iconSet.value]).toEqual(['outlined', 'outlined']);
  });

  it('draws the variant of the current set in every app icon', async () => {
    const { mount } = await import('@vue/test-utils');
    const { IconClose } = await import('@/components/icons');
    const { iconSet } = await import('@/theme/iconSet');
    iconSet.value = 'outlined';
    const w = mount(IconClose);
    const outlined = w.html();
    iconSet.value = 'sharp';
    await w.vm.$nextTick();
    expect(w.html()).not.toBe(outlined);
    expect(w.get('svg').attributes('data-icon-set')).toBe('sharp');
    iconSet.value = 'outlined';
  });
});
