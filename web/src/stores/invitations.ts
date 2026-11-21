/** Invitations to share a list or category (feature shared-lists): the device keeps the server's answer, so cards and the pending line show offline; answering needs the server. */
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { ApiError } from '@/api/apiError';
import { api } from '@/api/client';
import type { InvitationsAnswer, SentInvitation } from '@/api/types';
import { t, type MessageKey } from '@/i18n';
import { useDeviceStore } from './device';
import { useSyncStore } from './sync';
import { useUiStore } from './ui';

const NONE: InvitationsAnswer = { invitations: [], sent: [] };

export const useInvitationsStore = defineStore('invitations', () => {
  const device = useDeviceStore();
  const answer = computed(() => device.file<InvitationsAnswer>('invitations') ?? NONE);
  /** The ids this device already told the person about (kept on the device, not sent anywhere). */
  const announced = computed(() => device.file<string[]>('invitationsAnnounced') ?? []);

  /** Ids whose answer is on its way: their buttons wait. */
  const answering = ref<string[]>([]);

  /** Takes an invitation off the device copy. */
  function forget(id: string): void {
    const now = answer.value;
    device.putFile('invitations', { invitations: now.invitations.filter((i) => i.id !== id), sent: now.sent.filter((i) => i.id !== id) });
  }

  async function refresh(): Promise<void> {
    try {
      device.putFile('invitations', await api.invitations());
    } catch { /* offline: the device copy stays */ }
  }

  function markAnnounced(ids: string[]): void {
    device.putFile('invitationsAnnounced', ids);
  }

  /** The invitation this person sent for a list or category, if one is waiting. */
  const sentFor = (kind: SentInvitation['kind'], target: string): SentInvitation | null =>
    answer.value.sent.find((i) => i.kind === kind && i.target === target) ?? null;

  /** Answers one invitation; the card or pending line goes at once, and what an accept shared arrives with the next sync. */
  async function respond(id: string, verb: 'accept' | 'decline' | 'withdraw'): Promise<boolean> {
    if (answering.value.includes(id)) return false;
    answering.value = [...answering.value, id];
    try {
      await api.answerInvitation(id, verb);
    } catch (e) {
      const failed: MessageKey = verb === 'accept' ? 'sharing.invite.acceptFailed' : verb === 'decline' ? 'sharing.invite.declineFailed' : 'sharing.invite.withdrawFailed';
      useUiStore().notify(e instanceof ApiError ? e.userMessage : t(failed));
      // the server does not know it any more (lapsed, withdrawn, answered elsewhere): the stale card goes
      if (e instanceof ApiError && e.status === 404) { forget(id); void refresh(); }
      return false;
    } finally {
      answering.value = answering.value.filter((x) => x !== id);
    }
    forget(id);
    if (verb === 'accept') void useSyncStore().syncNow('changed');
    return true;
  }

  return { answer, answering, announced, refresh, markAnnounced, sentFor, respond };
});
