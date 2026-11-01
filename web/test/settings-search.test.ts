/** Settings search over the catalogue (feature settings-search). */
import { afterEach, describe, expect, it } from 'vitest';
import { applyLanguage, hasKey } from '@/i18n';
import { normalize, resolveTarget, searchSettings, searchSources, settingRoute, SETTINGS } from '@/components/settings/catalog';

const find = (q: string, cals: { id: string; name: string }[] = []) => searchSettings(q, searchSources(cals)).map((h) => `${h.label} | ${h.path}`);

describe('settings search', () => {
  afterEach(async () => { await applyLanguage('en'); });

  it('finds a setting by its name', () => {
    expect(find('side by side')).toEqual(['Events side by side: day | Views › Week and day', 'Events side by side: week | Views › Week and day']);
  });

  it('ignores capitals, accents and dashes', () => {
    expect(normalize('LEFT-HANDED Ünïcode')).toBe('left handed unicode');
    expect(find('LEFT-HANDED')).toContain('Left-handed mode | Appearance & layout › More');
  });

  it('finds a setting by a word of its description and by a synonym', () => {
    expect(find('readable')).toContain('Minimum event length | Views › General');
    expect(find('dark mode')).toContain('Theme | Appearance & layout');
  });

  it('finds a calendar by its name', () => {
    expect(find('work', [{ id: 'w1', name: 'Work' }])).toContain('Work | Calendars');
  });

  it('finds nothing for an unknown word or an empty query', () => {
    expect(find('xylophone')).toEqual([]);
    expect(find('   ')).toEqual([]);
  });

  it('has one control for task list reminders and one for the bedtime reminder', () => {
    expect(find('task lists with a time')).toEqual(['Before task lists with a time | Reminders › Task lists']);
    expect(find('bedtime reminder')).toEqual(['Reminder | Focus & calm › Bedtime']);
  });

  it('searches only the language the app is shown in', async () => {
    await applyLanguage('de');
    expect(find('ruhe').some((r) => r.startsWith('Ruhemodus |'))).toBe(true);
    expect(find('calm mode')).toEqual([]);
  });

  it('every catalogue key exists', () => {
    for (const s of SETTINGS) for (const k of [s.label, s.hint, s.synonyms]) if (k) expect(hasKey(k), k).toBe(true);
  });
});

describe('where a result leads', () => {
  const on = (ids: string[]) => (id: string) => ids.includes(id);

  it('a visible setting leads to itself', () => {
    expect(resolveTarget('sounds', on([]))?.id).toBe('sounds');
    expect(resolveTarget('morningTime', on(['morning']))?.id).toBe('morningTime');
  });

  it('a setting hidden behind a switch leads to that switch', () => {
    expect(resolveTarget('morningTime', on([]))?.id).toBe('morning');
    expect(resolveTarget('approachWindow', on([]))?.id).toBe('approachingCard');
    expect(resolveTarget('sleep', on([]))?.id).toBe('bedtimeOn');
  });

  it('a Labs feature leads to the Labs switch while Labs is off', () => {
    expect(resolveTarget('handwriting', on([]))?.id).toBe('labs');
    expect(resolveTarget('weekTwoRowSplit', on(['labs']))?.id).toBe('weekTwoRow');
  });

  it('routes to the group page or its sub-page with the setting to highlight', () => {
    expect(settingRoute({ group: 'focus' }, 'sounds')).toEqual({ path: '/settings/focus', query: { focus: 'sounds' } });
    expect(settingRoute({ group: 'focus', page: 'bedtime' }, 'bedtimeReminder')).toEqual({ path: '/settings/focus/bedtime', query: { focus: 'bedtimeReminder' } });
  });
});
