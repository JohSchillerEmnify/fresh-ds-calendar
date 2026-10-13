import { afterEach, describe, expect, it } from 'vitest';
import { applyLanguage } from '@/i18n';
import { newForm, validate } from '@/features/calendar/eventForm';
import { formatDuration } from '@/features/calendar/timeline';

describe('calendar messages follow the language', () => {
  afterEach(async () => { await applyLanguage('en'); });

  it('formats durations in English and German', async () => {
    expect(formatDuration(80)).toBe('1 h 20 min');
    await applyLanguage('de');
    expect(formatDuration(80)).toBe('1 Std. 20 Min.');
  });

  it('validation messages are looked up in the active language', async () => {
    const empty = newForm('2026-01-05', '09:00', 'primary', null);
    expect(validate(empty)?.message).toBe('Title is required');
    await applyLanguage('de');
    expect(validate(empty)?.message).toBe('Der Titel fehlt');
  });
});
