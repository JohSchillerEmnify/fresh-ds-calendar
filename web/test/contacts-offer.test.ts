import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import type { Calendar } from '@/api/types';
import { useContactsOffer } from '@/features/calendar/contactsOffer';
import { useCalendarsStore } from '@/stores/calendars';
import { usePrefsStore } from '@/stores/prefs';
import { useUiStore } from '@/stores/ui';

const birthdays = (contactsPermission: 'granted' | 'missing'): Calendar => ({
  id: 'birthdays', name: 'Birthdays', color: '#9fc6e7', primary: false, writable: false, defaultReminders: [], virtual: true, hidden: false, contactsPermission,
});

beforeEach(() => { setActivePinia(createPinia()); });

function setup(permission: 'granted' | 'missing') {
  const cals = useCalendarsStore();
  const prefs = usePrefsStore();
  const ui = useUiStore();
  cals.fromDevice([birthdays(permission)]);
  prefs.fromDevice({});
  useContactsOffer();
  return { cals, prefs, ui };
}
const offer = (ui: ReturnType<typeof useUiStore>) => ui.snackbars.filter((s) => s.testid === 'contacts-offer');

describe('the Google Contacts offer', () => {
  it('stays on screen until tapped while the permission is missing, with the Allow action', async () => {
    const { ui } = setup('missing');
    await nextTick();
    expect(offer(ui)).toEqual([expect.objectContaining({ text: 'Show birthdays from your Google Contacts too?', duration: 0, action: expect.objectContaining({ label: 'Allow', testid: 'contacts-offer-allow' }) })]);
  });

  it('is not shown with the permission, and goes away when it is granted', async () => {
    const { cals, ui } = setup('granted');
    await nextTick();
    expect(offer(ui)).toEqual([]);
    cals.fromDevice([birthdays('missing')]);
    await nextTick();
    expect(offer(ui)).toHaveLength(1);
    cals.fromDevice([birthdays('granted')]);
    await nextTick();
    expect(offer(ui)).toEqual([]);
  });

  it('is never shown to a person who said not now', async () => {
    const cals = useCalendarsStore();
    const prefs = usePrefsStore();
    const ui = useUiStore();
    cals.fromDevice([birthdays('missing')]);
    prefs.fromDevice({ contactsOfferDismissed: true });
    useContactsOffer();
    await nextTick();
    expect(offer(ui)).toEqual([]);
  });

  it('saves "not now" as a per-person preference when closed with the cross', async () => {
    const { ui, prefs } = setup('missing');
    const set = vi.spyOn(prefs, 'set').mockResolvedValue();
    await nextTick();
    offer(ui)[0]!.onClose!();
    expect(set).toHaveBeenCalledWith({ contactsOfferDismissed: true });
  });

  it('waits for the preferences, so a dismissed offer does not flash', async () => {
    const cals = useCalendarsStore();
    const ui = useUiStore();
    cals.fromDevice([birthdays('missing')]);
    useContactsOffer();
    await nextTick();
    expect(offer(ui)).toEqual([]);
  });
});
