import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { ApiError, api } from '@/api/client';
import type { Calendar } from '@/api/types';
import { saveCalendarColor } from '@/lib/calendarColor';
import { logUndone } from '@/lib/decisionLog';
import { calendarSettingChanges, replacedSettings } from '@/lib/deviceData';
import { clearDeviceLog, deviceLog } from '@/lib/deviceLog';

const cal = (over: Partial<Calendar> & { hidden?: boolean } = {}): Calendar & { hidden?: boolean } =>
  ({ id: 'c-secret-1', name: 'Anna private', color: '#112233', ...over }) as Calendar;

const refused = (): ApiError => {
  const e = new ApiError(400, 'VALIDATION_ERROR', 'no');
  e.seen = { method: 'PATCH', route: '/api/calendars/:id/color', status: 400, code: 'VALIDATION_ERROR' };
  return e;
};

describe('what the app undid or replaced is in the device log', () => {
  beforeEach(() => { localStorage.clear(); clearDeviceLog(); });

  it('logUndone names the change, the route and the code, without ids', () => {
    logUndone('calendar colour', refused());
    const e = deviceLog.value[0]!;
    expect(e.kind).toBe('decision');
    expect(e.summary).toBe('calendar colour rolled back PATCH /api/calendars/:id/color 400 VALIDATION_ERROR');
  });

  it('a refused calendar colour is put back and logged', async () => {
    const list = ref([cal()]);
    const err = refused();
    vi.spyOn(api, 'setCalendarColor').mockRejectedValue(err);
    await expect(saveCalendarColor(list, 'c-secret-1', '#ff0000', undefined, () => {})).rejects.toBe(err);
    expect(list.value[0]!.color).toBe('#112233');
    expect(deviceLog.value.map((x) => x.summary)).toEqual(['calendar colour rolled back PATCH /api/calendars/:id/color 400 VALIDATION_ERROR']);
    expect(JSON.stringify(deviceLog.value)).not.toContain('secret');
  });

  it('finds which calendar setting differs', () => {
    const a = [cal(), cal({ id: 'c2', hidden: false, defaultReminders: [10] })];
    const b = [cal({ color: '#ffffff' }), cal({ id: 'c2', hidden: true, defaultReminders: [30] })];
    expect(calendarSettingChanges(a, b)).toEqual([
      { id: 'c-secret-1', setting: 'colour' }, { id: 'c2', setting: 'hidden' }, { id: 'c2', setting: 'default reminders' },
    ]);
    expect(calendarSettingChanges(a, a)).toEqual([]);
  });

  it('reports a sync answer that replaces a setting set on this device less than 2 minutes ago', () => {
    const held = [cal({ color: '#ff0000' })];
    const incoming = [cal()];
    const touched = new Map([['c-secret-1:colour', 100_000]]);
    expect(replacedSettings(held, incoming, touched, 112_000)).toEqual([{ setting: 'colour', agoS: 12 }]);
    expect(replacedSettings(held, incoming, touched, 100_000 + 121_000)).toEqual([]);
    expect(replacedSettings(held, held, touched, 112_000)).toEqual([]);
  });
});
