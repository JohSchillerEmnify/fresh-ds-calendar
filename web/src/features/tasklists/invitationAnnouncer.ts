/** Tells the person once, with a snackbar, about an invitation that arrived on this device (feature shared-lists); "Show" opens the card in the Tasks view. */
import { nextTick, watch } from 'vue';
import { useRouter } from 'vue-router';
import { t } from '@/i18n';
import { useUiStore } from '@/stores/ui';
import { arrivalText, useInvitations } from './invitations';
import { useTasksViewStore } from './tasksStore';

/** localStorage key of the invitations this device already announced (ids). */
const ANNOUNCED_KEY = 'cal.invitationsAnnounced';
const SNACKBAR_MS = 10_000;

function loadAnnounced(): Set<string> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(ANNOUNCED_KEY) ?? '[]');
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []);
  } catch { return new Set(); }
}

/** Watches the device copy: every invitation not announced yet gets a snackbar. */
export function useInvitationAnnouncer(): void {
  const { answer } = useInvitations();
  const ui = useUiStore();
  const router = useRouter();
  const tasks = useTasksViewStore();
  const announced = loadAnnounced();

  async function show(): Promise<void> {
    await router.push('/tasks');
    await tasks.setTab('open').catch(() => undefined);
    await nextTick();
    document.querySelector('[data-testid="invitations"]')?.scrollIntoView({ block: 'start' });
  }

  watch(() => answer.value.invitations, (waiting) => {
    const fresh = waiting.filter((i) => !announced.has(i.id));
    if (!fresh.length) return;
    for (const i of fresh) {
      announced.add(i.id);
      ui.notify(arrivalText(i), { duration: SNACKBAR_MS, testid: 'invitation-snackbar', action: { label: t('sharing.invite.show'), testid: 'invitation-snackbar-show', run: () => { void show(); } } });
    }
    // only ids that still wait are kept, so the stored set cannot grow without end
    try { localStorage.setItem(ANNOUNCED_KEY, JSON.stringify(waiting.map((i) => i.id))); } catch { /* private window: the in-memory set still holds */ }
  }, { immediate: true });
}
