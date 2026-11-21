/** The words of an invitation, for the card and the snackbar (feature shared-lists). */
import type { IncomingInvitation } from '@/api/types';
import { t } from '@/i18n';

/** What a card says about its invitation. */
export const cardText = (i: IncomingInvitation): string =>
  i.kind === 'list' ? t('sharing.invite.textList', { address: i.from, title: i.title }) : t('sharing.invite.textCategory', { address: i.from, title: i.title });

/** What the snackbar says when an invitation arrives. */
export const arrivalText = (i: IncomingInvitation): string =>
  i.kind === 'list' ? t('sharing.invite.snackbar', { address: i.from, title: i.title }) : t('sharing.invite.snackbarCategory', { address: i.from, title: i.title });
