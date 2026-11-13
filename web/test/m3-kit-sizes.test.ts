// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import TextField from '@/components/m3/TextField.vue';

// The kit sizes from the material-web token files v0.192 (_md-comp-*.scss); jsdom applies no SFC styles, so the rules are read.
const css = (name: string) => readFileSync(resolve(__dirname, `../src/components/m3/${name}.vue`), 'utf8').split('<style scoped>')[1];
const rule = (text: string, selector: string) => {
  const m = new RegExp(`^${selector.replace(/[.[\]()]/g, '\\$&')} \\{([^}]*)\\}`, 'm').exec(text);
  if (!m) throw new Error(`no rule ${selector}`);
  return m[1].replace(/\s+/g, ' ');
};

describe('m3 kit sizes', () => {
  it('an icon button is 40 px drawn inside a 48 px tap area', () => {
    const r = rule(css('IconButton'), '.icon-btn');
    expect(r).toMatch(/width: 48px; height: 48px;/);
    // the transparent 4 px border is part of the tap area; background and overflow stop at the 40 px padding box
    expect(r).toMatch(/border: 4px solid transparent;/);
    expect(r).toMatch(/background-clip: padding-box;/);
    expect(r).toMatch(/border-radius: var\(--md-sys-shape-corner-full\)/);
  });

  it('a button is 40 px high on a 48 px tap area and stays round at any height', () => {
    const text = css('Button');
    const r = rule(text, '.m3-btn');
    expect(r).toMatch(/min-height: 48px;/);
    expect(r).toMatch(/border: 4px solid transparent;/);
    expect(r).toMatch(/background-clip: padding-box;/);
    // the extra 4 px left and right are tap area only: the button takes no more room than its drawn shape
    expect(r).toMatch(/margin-inline: -4px;/);
    // round up to a 56 px drawn height (2 × (32 − 4)); a corner-full base would make the pressed squish snap (touch-css)
    expect(r).toMatch(/border-radius: var\(--md-sys-shape-corner-extra-large\);/);
    expect(r).toMatch(/white-space: nowrap;/);
    expect(rule(text, '.outlined')).not.toMatch(/border:/);
  });

  it('a chip is 32 px high with 8 px corners', () => {
    const r = rule(css('Chip'), '.chip');
    expect(r).toMatch(/height: 32px;/);
    expect(r).toMatch(/border-radius: 8px;/);
    expect(rule(css('Chip'), '.chip.selected')).not.toMatch(/border-radius/);
  });

  it('a text field is filled by default and outlined on request', () => {
    const text = css('TextField');
    expect(rule(text, '.box')).toMatch(/border-radius: var\(--md-sys-shape-corner-extra-small\) var\(--md-sys-shape-corner-extra-small\) 0 0;/);
    expect(rule(text, '.box')).toMatch(/box-shadow: inset 0 -1px 0 var\(--md-sys-color-on-surface-variant\);/);
    expect(rule(text, '.box:focus-within')).toMatch(/box-shadow: inset 0 -2px 0 var\(--md-sys-color-primary\);/);
    expect(rule(text, '.outlined .box')).toMatch(/box-shadow: inset 0 0 0 1px var\(--md-sys-color-outline\);/);
    expect(rule(text, '.outlined .box:focus-within')).toMatch(/box-shadow: inset 0 0 0 2px var\(--md-sys-color-primary\);/);
    expect(mount(TextField, { props: { modelValue: '', label: 'Name' } }).classes()).not.toContain('outlined');
    expect(mount(TextField, { props: { modelValue: '', label: 'Name', variant: 'outlined' } }).classes()).toContain('outlined');
  });
});

describe('segmented choice', () => {
  it('a segmented choice has only the connected look', () => {
    const src = readFileSync(resolve(__dirname, '../src/components/m3/SegmentedButton.vue'), 'utf8');
    // no opt-in: the expressive connected group is the one look (no `connected` prop, no outlined bar)
    expect(src).not.toMatch(/connected\?:/);
    expect(rule(css('SegmentedButton'), '.seg')).toMatch(/gap: 2px;/);
    expect(rule(css('SegmentedButton'), '.seg')).not.toMatch(/border:/);
  });
});
