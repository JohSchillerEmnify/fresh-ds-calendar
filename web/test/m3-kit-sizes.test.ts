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

const styles = readFileSync(resolve(__dirname, '../src/styles.css'), 'utf8');
const token = (name: string) => new RegExp(`--md-sys-shape-corner-${name}: ([^;]+);`).exec(styles)?.[1];

describe('m3 kit sizes', () => {
  it('an icon button is 40 px drawn inside a 48 px tap area', () => {
    const r = rule(css('IconButton'), '.icon-btn');
    // 40 px drawn at Comfortable; the transparent border makes up the 48 px tap area, background and overflow stop at the drawing
    expect(r).toMatch(/--h: calc\(40px \+ var\(--md-density-shift\)\);/);
    expect(r).toMatch(/width: calc\(var\(--h\) \+ 2 \* var\(--tap\)\); height: calc\(var\(--h\) \+ 2 \* var\(--tap\)\);/);
    expect(r).toMatch(/border: var\(--tap\) solid transparent;/);
    expect(r).toMatch(/background-clip: padding-box;/);
    expect(r).toMatch(/border-radius: var\(--md-sys-shape-corner-full\)/);
  });

  it('a button is 40 px high on a 48 px tap area and stays round at any height', () => {
    const text = css('Button');
    const r = rule(text, '.m3-btn');
    expect(r).toMatch(/--h: calc\(40px \+ var\(--md-density-shift\)\);/);
    expect(r).toMatch(/min-height: calc\(var\(--h\) \+ 2 \* var\(--tap\)\);/);
    expect(r).toMatch(/border: 4px solid transparent; border-block-width: var\(--tap\);/);
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
    expect(r).toMatch(/--h: calc\(32px \+ var\(--md-density-shift\)\); height: var\(--h\);/);
    expect(r).toMatch(/border-radius: var\(--md-sys-shape-corner-small\);/);
    expect(token('small')).toBe('8px');
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

describe('density and shape scale', () => {
  // the one density shift (theme Density, Material's 4 px steps) added to each control's Comfortable container height
  const shift = (base: number) => new RegExp(`--h: (max\\(\\d+px, )?calc\\(${base}px \\+ var\\(--md-density-shift\\)\\)\\)?;`);
  // a transparent tap border makes up the difference to 48 px when the drawn control is lower
  const tap = /--tap: max\(0px, calc\(\(48px - var\(--h\)\) \/ 2\)\);/;

  it('every kit control takes its height from the one density shift', () => {
    expect(styles).toMatch(/^ {2}--md-density-shift: 0px;/m);
    const controls: [string, string, number][] = [
      ['Button', '.m3-btn', 40], ['IconButton', '.icon-btn', 40], ['SegmentedButton', '.opt', 40], ['Chip', '.chip', 32],
      ['TextField', '.tf', 56], ['Select', '.sel', 56], ['MenuField', '.fw', 56], ['ListItem', '.li', 56],
      ['Checkbox', '.cb', 40], ['Radio', '.rb', 40],
    ];
    for (const [file, sel, base] of controls) expect(rule(css(file), sel), `${file} ${sel}`).toMatch(shift(base));
    // a filled field keeps 52 px so its floating label fits (MDC $minimum-height-for-filled-label); a list row keeps 48
    for (const [file, sel] of [['TextField', '.tf'], ['Select', '.sel'], ['MenuField', '.fw']]) expect(rule(css(file), sel)).toMatch(/--h: max\(52px, /);
    expect(rule(css('ListItem'), '.li')).toMatch(/--h: max\(48px, /);
    // the settings row (a list item with its control at the end) follows the same shift
    expect(readFileSync(resolve(__dirname, '../src/components/settings/SettingRow.vue'), 'utf8')).toMatch(/min-height: calc\(64px \+ var\(--md-density-shift\)\);/);
    // nothing in the kit sets a fixed 40 or 56 px control height of its own any more
    for (const file of ['Button', 'IconButton', 'SegmentedButton', 'TextField', 'Select', 'MenuField', 'ListItem']) expect(css(file), file).not.toMatch(/(min-)?height: (40|56)px/);
  });

  it('none of them can be tapped on less than 48 by 48 pixels', () => {
    for (const [file, sel] of [['Button', '.m3-btn'], ['IconButton', '.icon-btn'], ['SegmentedButton', '.opt']]) {
      const r = rule(css(file), sel);
      expect(r, file).toMatch(tap);
      expect(r, file).toMatch(/border(-block-width)?: var\(--tap\)/);
      expect(r, file).toMatch(/background-clip: padding-box;/);
    }
    expect(rule(css('Button'), '.m3-btn')).toMatch(/min-width: 48px;/);
    // checkbox, radio and switch: a fixed 48 px target, only the drawing follows the density
    expect(rule(css('Checkbox'), '.cb')).toMatch(/width: 48px; height: 48px;/);
    expect(rule(css('Radio'), '.rb')).toMatch(/width: 48px; height: 48px;/);
    expect(rule(css('Switch'), '.switch')).toMatch(/height: 48px;/);
  });

  it('the base corner sizes are the Material 3 shape scale', () => {
    // material-web tokens v0.192 _md-sys-shape.scss
    expect(['extra-small', 'small', 'medium', 'large', 'extra-large', 'full'].map(token)).toEqual(['4px', '8px', '12px', '16px', '28px', '9999px']);
  });
});
