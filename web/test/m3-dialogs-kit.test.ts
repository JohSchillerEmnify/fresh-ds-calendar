import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';
import ListItem from '@/components/m3/ListItem.vue';

const src = (p: string) => fs.readFileSync(path.join(import.meta.dirname, '../src', p), 'utf8');
const template = (p: string) => { const s = src(p); return s.slice(s.indexOf('<template>'), s.indexOf('<style')); };

describe('overlays, toasts and suggestion lists are kit parts', () => {
  it.each(['components/shell/MonthPicker.vue', 'features/motivation/PlantCard.vue', 'features/calendar/MapPicker.vue'])('%s is an AdaptiveSheet, not its own dialog', (p) => {
    const tpl = template(p);
    expect(tpl).toContain('<AdaptiveSheet');
    expect(tpl).not.toMatch(/role="dialog"|class="[^"]*scrim/);
  });
  it.each(['features/calendar/MapPicker.vue', 'features/calendar/LocationField.vue'])('%s lists places as ListItem rows', (p) => {
    const tpl = template(p);
    expect(tpl).toContain('<ListItem');
    expect(tpl).not.toMatch(/<div[^>]*role="option"/);
  });
  it('the streak message is a kit snackbar, not its own toast', () => {
    expect(template('features/motivation/StreakToast.vue')).not.toMatch(/role="status"|snack-skin/);
    expect(src('features/motivation/StreakToast.vue')).toContain('ui.notify(');
  });
});

describe('AdaptiveSheet full page', () => {
  it('has no scrim or handle and says so in data-presentation', () => {
    const w = mount(AdaptiveSheet, { props: { open: true, full: true, label: 'Page', testid: 'pg' }, slots: { default: 'x' }, attachTo: document.body });
    expect(w.find('[data-testid="sheet-scrim"]').exists()).toBe(false);
    expect(w.find('.handle').exists()).toBe(false);
    expect(w.find('[data-testid="pg"]').attributes('data-presentation')).toBe('page');
    w.unmount();
  });
});

describe('AdaptiveSheet drop strip', () => {
  it('is a strip under the anchor with a scrim that starts below the bar', () => {
    const w = mount(AdaptiveSheet, { props: { open: true, drop: true, anchor: { left: 0, top: 64, maxH: 500 }, label: 'Strip', testid: 'dr' }, slots: { default: 'x' }, attachTo: document.body });
    const panel = w.find('[data-testid="dr"]');
    expect(panel.attributes('data-presentation')).toBe('drop');
    expect(panel.attributes('style')).toContain('top: 64px');
    expect(w.find('[data-testid="sheet-scrim"]').attributes('style')).toContain('top: 64px');
    w.unmount();
  });
});

describe('ListItem as a choice', () => {
  it('marks the selected and tappable row', () => {
    const w = mount(ListItem, { props: { interactive: true, selected: true }, slots: { default: 'Berlin' } });
    expect(w.classes()).toEqual(expect.arrayContaining(['act', 'sel']));
  });
});
