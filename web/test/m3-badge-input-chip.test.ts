// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import Badge from '@/components/m3/Badge.vue';
import Chip from '@/components/m3/Chip.vue';

// Sizes and colours from _md-comp-badge and _md-comp-input-chip (material-web tokens v0.192); jsdom applies no SFC styles, so the rules are read.
const css = (name: string) => readFileSync(resolve(__dirname, `../src/components/m3/${name}.vue`), 'utf8').split('<style scoped>')[1].replace(/\s+/g, ' ');

describe('Badge', () => {
  it('is a dot without a label and a pill with one', () => {
    expect(mount(Badge).classes()).not.toContain('large');
    const large = mount(Badge, { props: { label: 3 } });
    expect(large.classes()).toContain('large');
    expect(large.text()).toBe('3');
  });

  it('is 6 px as a dot and 16 px high as a pill, in the error colours', () => {
    const c = css('Badge');
    expect(c).toMatch(/\.m3-badge \{[^}]*width: 6px; height: 6px; border-radius: var\(--md-sys-shape-corner-full\); background-color: var\(--md-sys-color-error\)/);
    expect(c).toMatch(/\.m3-badge\.large \{[^}]*min-width: 16px; height: 16px;[^}]*color: var\(--md-sys-color-on-error\); font: var\(--md-sys-typescale-label-small\)/);
  });
});

describe('Chip input variant', () => {
  it('is no button itself; its x is the one button and says what it removes', async () => {
    const w = mount(Chip, { props: { variant: 'input', selected: true, removeLabel: 'Remove 10 min before', removeTestid: 'rm' }, slots: { default: '10 min before' } });
    expect(w.element.tagName).toBe('SPAN');
    const x = w.get('button');
    expect(x.attributes('aria-label')).toBe('Remove 10 min before');
    expect(x.attributes('data-testid')).toBe('rm');
    await x.trigger('click');
    expect(w.emitted('remove')).toHaveLength(1);
  });

  it('a static chip draws like a chip but is not a button', () => {
    const w = mount(Chip, { props: { static: true, selected: true }, slots: { default: '3 open' } });
    expect(w.element.tagName).toBe('SPAN');
    expect(w.find('button').exists()).toBe(false);
  });

  it('follows the density shift and keeps a 48 px tap area on its x', () => {
    const c = css('Chip');
    expect(c).toMatch(/\.chip \{ --h: calc\(32px \+ var\(--md-density-shift\)\); height: var\(--h\);/);
    expect(c).toMatch(/\.x::after \{ content: ''; position: absolute; inset: -15px; \}/);
  });
});

describe('outlined kit buttons', () => {
  it('sit on a solid surface so a scene never shows through', () => {
    expect(css('Button')).toMatch(/\.outlined \{ background-color: var\(--md-sys-color-surface\);/);
    expect(css('IconButton')).toMatch(/\.outlined \{ background-color: var\(--md-sys-color-surface\);/);
  });
});
