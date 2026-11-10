import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { IconAdd, IconCalendarMonth, IconCheck, IconClose, IconCloudOff, IconMoreHoriz } from '@/components/icons';
import { ICON_SETS, sanitizeFine } from '@/theme/fine';
import { iconSet, type IconSet } from '@/theme/iconSet';

/** The drawn shape of one mounted icon. */
const drawn = (icon: typeof IconCalendarMonth, set?: IconSet) => {
  const w = mount(icon, { props: { set } });
  return { set: w.find('svg').attributes('data-icon-set'), d: w.html() };
};

describe('app icons follow the icon set', () => {
  it('offer six sets', () => {
    expect(ICON_SETS).toEqual(['outlined', 'rounded', 'sharp', 'solar', 'phosphor', 'pixelart']);
  });
  it('draw the current set and every set has its own shape', () => {
    const shapes = ICON_SETS.map((set) => { iconSet.value = set; return drawn(IconCalendarMonth); });
    expect(shapes.map((s) => s.set)).toEqual(ICON_SETS);
    expect(new Set(shapes.map((s) => s.d)).size).toBe(ICON_SETS.length);
    iconSet.value = 'outlined';
  });
  it('map the offline icon to a stand-in in every set', () => {
    const shapes = ICON_SETS.map((set) => drawn(IconCloudOff, set));
    expect(shapes.every((s) => s.d.includes('<svg'))).toBe(true);
    expect(new Set(shapes.map((s) => s.d)).size).toBe(ICON_SETS.length);
  });
  it('draw the Phosphor plus, check, x and dots without the duotone fill that looks like a box', () => {
    for (const icon of [IconAdd, IconCheck, IconClose, IconMoreHoriz]) expect(drawn(icon, 'phosphor').d).not.toContain('opacity');
    expect(drawn(IconCalendarMonth, 'phosphor').d).toContain('opacity');
  });
  it('an explicit set prop wins over the current set', () => {
    iconSet.value = 'outlined';
    expect(drawn(IconCalendarMonth, 'solar').set).toBe('solar');
  });
  it('keep old saved values working and drop unknown ones', () => {
    expect(sanitizeFine({ icons: 'rounded' }).icons).toBe('rounded');
    expect(sanitizeFine({ icons: 'comic' }).icons).toBeUndefined();
  });
});
