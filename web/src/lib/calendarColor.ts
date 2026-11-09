/** Saving the person's colour of a calendar: shown at once on the calendar and its events, put back when the server refuses. */
import type { Ref } from 'vue';
import { api } from '@/api/client';
import type { Calendar } from '@/api/types';
import { logUndone } from './decisionLog';

/** Recolours `id` in `list` to `color` and (through `putDevice`) the device copy, then tells the server (the palette `colorId` when there is one); a refused save puts the old colour back (nothing else) and rethrows. */
export async function saveCalendarColor(list: Ref<Calendar[]>, id: string, color: string, colorId: string | undefined, putDevice: (list: Calendar[]) => void): Promise<void> {
  const old = list.value.find((c) => c.id === id)?.color;
  const put = (next: Calendar[]) => { list.value = next; putDevice(next); };
  const paint = (to: string) => put(list.value.map((c) => (c.id === id ? { ...c, color: to } : c)));
  paint(color);
  try {
    await api.setCalendarColor(id, colorId ? { colorId } : { color });
    putDevice(list.value);
  } catch (e) {
    if (old) paint(old);
    logUndone('calendar colour', e);
    throw e;
  }
}
