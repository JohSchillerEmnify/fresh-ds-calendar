import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { IconCalendarMonth } from '@/components/icons';
import { iconSet } from '@/theme/iconSet';

/** The drawn shape of one mounted icon. */
const drawn = (set?: 'outlined' | 'rounded' | 'sharp') => {
  const w = mount(IconCalendarMonth, { props: { set } });
  return { set: w.find('svg').attributes('data-icon-set'), d: w.findAll('path').map((p) => p.attributes('d')).join('') };
};

describe('app icons follow the icon set', () => {
  it('draw the current set and change shape when it changes', () => {
    iconSet.value = 'outlined';
    const outlined = drawn();
    iconSet.value = 'rounded';
    const rounded = drawn();
    iconSet.value = 'sharp';
    const sharp = drawn();
    expect([outlined.set, rounded.set, sharp.set]).toEqual(['outlined', 'rounded', 'sharp']);
    expect(new Set([outlined.d, rounded.d, sharp.d]).size).toBe(3);
    iconSet.value = 'outlined';
  });
  it('an explicit set prop wins over the current set', () => {
    iconSet.value = 'outlined';
    expect(drawn('sharp').set).toBe('sharp');
  });
});
