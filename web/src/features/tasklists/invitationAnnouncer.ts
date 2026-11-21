/** Tells the person once, with a snackbar, about an invitation that arrived on this device (feature shared-lists); "Show" opens the card in the Tasks view. */
import { nextTick, watch } from 'vue';
import { useRouter } from 'vue-router';
import { t } from '@/i18n';
import { useInvitationsStore } from '@/stores/invitations';
import { useUiStore } from '@/stores/ui';
import { arrivalText } from './invitations';
import { useTasksViewStore } from './tasksStore';

const SNACKBAR_MS = 10_000;

/** Watches the device copy: every invitation not announced yet gets a snackbar. */
export function useInvitationAnnouncer(): void {
  const invitations = useInvitationsStore();
  const ui = useUiStore();
  const router = useRouter();
  const tasks = useTasksViewStore();
  const told = new Set<string>();

  async function show(): Promise<void> {
    await router.push('/tasks');
    await tasks.setTab('open').catch(() => undefined);
    await nextTick();
    document.querySelector('[data-testid="invitations"]')?.scrollIntoView({ block: 'start' });
  }

  watch(() => invitations.answer.invitations, (waiting) => {
    const known = new Set([...invitations.announced, ...told]);
    const fresh = waiting.filter((i) => !known.has(i.id));
    for (const i of fresh) {
      told.add(i.id);
      ui.notify(arrivalText(i), { duration: SNACKBAR_MS, testid: 'invitation-snackbar', action: { label: t('sharing.invite.show'), testid: 'invitation-snackbar-show', run: () => { void show(); } } });
    }
    // only ids that still wait are kept, so the stored list cannot grow without end
    if (fresh.length) invitations.markAnnounced(waiting.map((i) => i.id));
  }, { immediate: true });
}
