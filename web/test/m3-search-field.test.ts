// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SearchField from '@/components/m3/SearchField.vue';

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
    for (const f of ['views/SettingsView.vue', 'features/calendar/MapPicker.vue', 'components/settings/TimeField.vue']) expect(src(f)).not.toMatch(/<input/);
  });
});
