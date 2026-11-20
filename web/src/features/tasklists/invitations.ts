/**
 * Invitations to share a list or a category (feature shared-lists, ADR 0047): the device keeps the server's answer, so the
 * cards and the sharer's pending line show offline. Answering needs the server.
 */
import { computed } from 'vue';
import { api } from '@/api/client';
import { ApiError } from '@/api/apiError';
import type { IncomingInvitation, InvitationsAnswer, SentInvitation } from '@/api/types';
import { t } from '@/i18n';
import type { MessageKey } from '@/i18n';
import { useDeviceStore } from '@/stores/device';
import { useSyncStore } from '@/stores/sync';
import { useUiStore } from '@/stores/ui';

const NONE: InvitationsAnswer = { invitations: [], sent: [] };

/** The invitations of the device copy, asking the server again with `refresh`, and the three ways to answer one. */
export function useInvitations() {
  const device = useDeviceStore();
  const answer = computed(() => device.file<InvitationsAnswer>('invitations') ?? NONE);

  async function refresh(): Promise<void> {
    try {
      device.putFile('invitations', await api.invitations());
    } catch { /* offline: the device copy stays */ }
  }

  /** The invitation this person sent for a list or category, if one is waiting. */
  const sentFor = (kind: SentInvitation['kind'], target: string): SentInvitation | null =>
    answer.value.sent.find((i) => i.kind === kind && i.target === target) ?? null;

  /** Answers one invitation; the card or pending line goes at once, and what an accept shared arrives with the next sync. */
  async function respond(id: string, verb: 'accept' | 'decline' | 'withdraw'): Promise<boolean> {
    try {
      await api.answerInvitation(id, verb);
    } catch (e) {
      const failed: MessageKey = verb === 'accept' ? 'sharing.invite.acceptFailed' : verb === 'decline' ? 'sharing.invite.declineFailed' : 'sharing.invite.withdrawFailed';
      useUiStore().notify(e instanceof ApiError ? e.userMessage : t(failed));
      return false;
    }
    const now = answer.value;
    device.putFile('invitations', { invitations: now.invitations.filter((i) => i.id !== id), sent: now.sent.filter((i) => i.id !== id) });
    if (verb === 'accept') void useSyncStore().syncNow('changed');
    return true;
  }

  return { answer, refresh, sentFor, respond };
}

/** What a card says about its invitation. */
export const cardText = (i: IncomingInvitation): string =>
  i.kind === 'list' ? t('sharing.invite.textList', { address: i.from, title: i.title }) : t('sharing.invite.textCategory', { address: i.from, title: i.title });

/** What the snackbar says when an invitation arrives. */
export const arrivalText = (i: IncomingInvitation): string =>
  i.kind === 'list' ? t('sharing.invite.snackbar', { address: i.from, title: i.title }) : t('sharing.invite.snackbarCategory', { address: i.from, title: i.title });
