import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ApiError } from '@/api/client';
import type { Person, TaskList } from '@/api/types';
import { useItemsStore } from '@/stores/items';
import { badgeInitial, isMemberOnly, leaveList, shareList, unshareList, withNames } from '@/features/tasklists/sharing';
import { apiError, mockFetch } from './helpers';

const person = (name: string): Person => ({ sub: name.toLowerCase(), name, email: `${name.toLowerCase()}@example.com`, initial: name[0]! });
const list = (id: string, shared?: TaskList['shared']): TaskList => ({
  kind: 'tasklist', id, calendarId: shared ? 'shared' : 'tasks', title: 'Groceries', date: null, time: null, items: [], doneCount: 0, totalCount: 0,
  estimateMinutes: null, recurrence: null, categoryId: null, tags: [], color: '#039be5', calendarColor: '#039be5', completedOn: null, canvas: null, etag: '"1"', updated: '2026-10-12T08:00:00+02:00', ...(shared ? { shared } : {}),
});

describe('sharing helpers', () => {
  it('shows the other person\'s initial and tells a member from the owner', () => {
    const mine = list('shared:a', { owned: true, owner: person('Jo'), with: [person('Anna')] });
    const hers = list('shared:a', { owned: false, owner: person('Jo'), with: [person('Jo')] });
    expect(badgeInitial(mine)).toBe('A');
    expect(badgeInitial(hers)).toBe('J');
    expect(badgeInitial(list('x'))).toBeNull();
    expect([isMemberOnly(mine), isMemberOnly(hers), isMemberOnly(list('x')), isMemberOnly(null)]).toEqual([false, true, false, false]);
    expect(withNames([person('Anna'), person('Bob')])).toBe('Anna, Bob');
  });
});

describe('share, stop sharing and leave', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('swaps the cached list for the one under its new id', async () => {
    const items = useItemsStore();
    items.upsert(list('g1'));
    const { calls } = mockFetch({
      'POST /api/tasklists/g1/share': () => list('shared:s1', { owned: true, owner: person('Jo'), with: [person('Anna')] }),
      'GET /api/tasklists/open': () => ({ items: [], finishedToday: [] }),
    });
    await shareList('g1', 'anna');
    expect(calls[0].body).toEqual({ person: 'anna' });
    expect(items.get('g1')).toBeUndefined();
    expect(items.get('shared:s1')).toMatchObject({ calendarId: 'shared' });
  });

  it('moves a list back with "Stop sharing" and drops it for a member who leaves', async () => {
    const items = useItemsStore();
    items.upsert(list('shared:s1', { owned: true, owner: person('Jo'), with: [person('Anna')] }));
    mockFetch({
      'DELETE /api/tasklists/shared%3As1/share': () => list('g2'),
      'POST /api/tasklists/shared%3As2/leave': () => null,
      'GET /api/tasklists/open': () => ({ items: [], finishedToday: [] }),
    });
    await unshareList('shared:s1');
    expect(items.get('shared:s1')).toBeUndefined();
    expect(items.get('g2')).toMatchObject({ calendarId: 'tasks' });
    items.upsert(list('shared:s2', { owned: false, owner: person('Jo'), with: [person('Jo')] }));
    await leaveList('shared:s2');
    expect(items.get('shared:s2')).toBeUndefined();
  });

  it('keeps the list and reports the server\'s message when sharing is refused', async () => {
    const items = useItemsStore();
    items.upsert(list('g1'));
    mockFetch({ 'POST /api/tasklists/g1/share': () => { const r = apiError(400, 'VALIDATION_ERROR', 'A repeating task list cannot be shared'); (r.body.error as { key?: string }).key = 'sharing.repeating'; return r; } });
    const e = await shareList('g1', 'anna').catch((x) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e.userMessage).toBe('A repeating task list cannot be shared.');
    expect(items.get('g1')).toBeDefined();
  });
});
