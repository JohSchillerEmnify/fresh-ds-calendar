import { afterEach, describe, expect, it } from 'vitest';
import { carriedLabel, formatEstimate } from '@/features/tasklists/format';
import { applyLanguage, t } from '@/i18n';

afterEach(async () => { await applyLanguage('en'); });

describe('task list texts in other languages', () => {
  it('pluralises the streak and sunflower labels', async () => {
    expect([0, 1, 2].map((n) => t('tasks.streak.label', { count: n }, n))).toEqual(['Streak: 0 days', 'Streak: 1 day', 'Streak: 2 days']);
    await applyLanguage('de');
    expect([1, 3].map((n) => t('tasks.sunflowers.label', { count: n }, n))).toEqual(['Sonnenblumenfeld: 1 Blume', 'Sonnenblumenfeld: 3 Blumen']);
  });
  it('translates estimates and the carried-over label', async () => {
    await applyLanguage('de');
    expect(formatEstimate(90)).toBe('~1 Std. 30 Min.');
    expect(carriedLabel('2026-10-10')).toMatch(/^Von Sa/);
  });
});
