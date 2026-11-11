/** The offer to show birthdays from Google Contacts (feature contact-birthdays): a snackbar while the permission is missing, "not now" for good. */
import { watch } from 'vue';
import { t } from '@/i18n';
import { useCalendarsStore } from '@/stores/calendars';
import { usePrefsStore } from '@/stores/prefs';
import { useUiStore } from '@/stores/ui';

/** Asks Google for the Contacts permission (the sign-in round trip with the extra scope); `inSettings` returns to the Birthdays settings. */
export function allowContacts(inSettings = false): void {
  window.location.assign(`/api/auth/google/start?contacts=1${inSettings ? '&to=settings' : ''}`);
}

/** Keeps the offer on screen exactly while the permission is missing and the person has not said "not now". */
export function useContactsOffer(): void {
  const ui = useUiStore();
  const cals = useCalendarsStore();
  const prefs = usePrefsStore();
  let shown: number | null = null;
  const missing = () => cals.stored.find((c) => c.id === 'birthdays')?.contactsPermission === 'missing';
  watch(() => prefs.loaded && missing() && !prefs.contactsOfferDismissed, (want) => {
    const visible = shown !== null && ui.snackbars.some((s) => s.id === shown);
    if (want && !visible) {
      shown = ui.notify(t('calendar.contacts.offer'), {
        duration: 0, testid: 'contacts-offer',
        action: { label: t('calendar.contacts.allow'), testid: 'contacts-offer-allow', run: () => allowContacts() },
        onClose: () => { void prefs.set({ contactsOfferDismissed: true }).catch(() => undefined); },
      });
    } else if (!want && visible) ui.dismiss(shown!);
  }, { immediate: true });
}
