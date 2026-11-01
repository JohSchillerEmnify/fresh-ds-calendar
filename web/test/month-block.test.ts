/** The month blocks of the list that scrolls up and down (feature month-vertical): header, empty neighbour cells, fixed week height. */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import MonthView from '@/views/MonthView.vue';
import { freshPinia } from './helpers';

const OCT = new Date(2026, 9, 1);
/** The month view reads the route's filters, so it needs a router. */
const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<i />' } }] });
const view = (props: { anchor: Date; block?: 'vertical' | 'vertical-snap' }) => mount(MonthView, { props, global: { plugins: [router] } });
const cells = (w: ReturnType<typeof view>) => w.findAll('[data-testid="month-cell"]').map((c) => c.attributes('data-date'));

describe('MonthView as a month block', () => {
  it('continuous: a month header, no weekday row, every date of the month once, the other month empty', () => {
    freshPinia();
    const w = view({ anchor: OCT, block: 'vertical' });
    expect(w.find('[data-testid="month-block-header"]').text()).toBe('October 2026');
    expect(w.attributes('data-testid')).toBe('month-block');
    expect(w.attributes('data-month')).toBe('2026-10');
    expect(w.find('[data-testid="month-weekday-header"]').exists()).toBe(false);
    const dates = cells(w);
    expect(dates).toHaveLength(31);
    expect(dates[0]).toBe('2026-10-01');
    expect(dates.at(-1)).toBe('2026-10-31');
    // 5 weeks of 7 cells, 4 before 1 October and 6 after 31 October are placeholders
    expect(w.findAll('[data-empty="true"]')).toHaveLength(35 - 31);
    expect(w.find('[data-outside-month]').exists()).toBe(false);
    expect(w.find('.grid').attributes('style')).toContain('repeat(5, 96px)');
  });

  it('one month at a time: the neighbouring days are shown greyed', () => {
    freshPinia();
    const w = view({ anchor: OCT, block: 'vertical-snap' });
    expect(w.findAll('[data-testid="month-cell"]')).toHaveLength(35);
    expect(w.find('[data-empty="true"]').exists()).toBe(false);
    expect(w.find('[data-testid="month-cell"][data-date="2026-11-01"]').attributes('data-outside-month')).toBe('true');
  });

  it('the sideways month is unchanged: weekday row, no header, measured rows', () => {
    freshPinia();
    const w = view({ anchor: OCT });
    expect(w.attributes('data-testid')).toBe('month-view');
    expect(w.attributes('data-scroll')).toBe('sideways');
    expect(w.findAll('[data-testid="month-weekday-header"]')).toHaveLength(7);
    expect(w.find('[data-testid="month-block-header"]').exists()).toBe(false);
  });
});
