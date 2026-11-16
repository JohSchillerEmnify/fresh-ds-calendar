// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SearchField from '@/components/m3/SearchField.vue';
import TimeInput from '@/components/m3/TimeInput.vue';

const src = (p: string) => readFileSync(resolve(__dirname, `../src/${p}`), 'utf8');

describe('m3 search field', () => {
  it('is a search input that reports typing and clears', async () => {
    const w = mount(SearchField, { props: { modelValue: 'ab', label: 'Search', clearLabel: 'Clear', barTestid: 'bar' }, attrs: { 'data-testid': 'in' } });
    expect(w.find('[data-testid="bar"]').exists()).toBe(true);
    const input = w.find('[data-testid="in"]');
    expect(input.attributes('type')).toBe('search');
    await input.setValue('abc');
    expect(w.emitted('update:modelValue')![0]).toEqual(['abc']);
    await w.find('[data-testid="search-clear"]').trigger('click');
    expect(w.emitted('update:modelValue')![1]).toEqual(['']);
  });

  it('shows no clear button without text or without a label', () => {
    expect(mount(SearchField, { props: { modelValue: '', label: 'S', clearLabel: 'C' } }).find('[data-testid="search-clear"]').exists()).toBe(false);
    expect(mount(SearchField, { props: { modelValue: 'x', label: 'S' } }).find('[data-testid="search-clear"]').exists()).toBe(false);
  });

  it('is 56 px high and full round', () => {
    expect(src('components/m3/SearchField.vue')).toMatch(/min-height: 56px;[^}]*border-radius: var\(--md-sys-shape-corner-full\)/);
  });

  it('is the only search or time input: no raw ones in the screens', () => {
    for (const f of ['views/SettingsView.vue', 'features/calendar/MapPicker.vue', 'components/settings/TimeField.vue', 'features/tasklists/TasksView.vue']) expect(src(f)).not.toMatch(/<input/);
  });
});

describe('m3 time input', () => {
  it('reports hour and minute separately and is 96 x 80 like the Android time picker', async () => {
    const w = mount(TimeInput, { props: { hour: '08', minute: '30', hourLabel: 'Hour', minuteLabel: 'Minute', hourTestid: 'h', minuteTestid: 'm' } });
    await w.find('[data-testid="h"]').setValue('09');
    await w.find('[data-testid="m"]').setValue('45');
    expect(w.emitted('update:hour')![0]).toEqual(['09']);
    expect(w.emitted('update:minute')![0]).toEqual(['45']);
    expect(src('components/m3/TimeInput.vue')).toMatch(/width: 96px; height: 80px;/);
  });
});
