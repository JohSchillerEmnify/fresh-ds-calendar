<script setup lang="ts">
/** The invitations to share a list or a category that wait for an answer (feature shared-lists): a card each, above the groups of the Tasks view. */
import Button from '@/components/m3/Button.vue';
import { t } from '@/i18n';
import { useInvitationsStore } from '@/stores/invitations';
import { cardText } from './invitations';

const invitations = useInvitationsStore();
</script>

<template>
  <section v-if="invitations.answer.invitations.length" class="inv" data-testid="invitations">
    <article
      v-for="i in invitations.answer.invitations" :key="i.id" class="card" data-testid="invitation-card" :data-kind="i.kind" :data-title="i.title"
    >
      <h2 class="t">{{ t(i.kind === 'list' ? 'sharing.invite.cardList' : 'sharing.invite.cardCategory') }}</h2>
      <p class="x">{{ cardText(i) }}</p>
      <div class="acts">
        <Button variant="text" data-testid="invitation-decline" :disabled="invitations.answering.includes(i.id)" @click="invitations.respond(i.id, 'decline')">{{ t('sharing.invite.decline') }}</Button>
        <Button data-testid="invitation-accept" :disabled="invitations.answering.includes(i.id)" @click="invitations.respond(i.id, 'accept')">{{ t('sharing.invite.accept') }}</Button>
      </div>
    </article>
  </section>
</template>

<style scoped>
.inv { max-width: 760px; margin: 0 auto 8px; display: flex; flex-direction: column; gap: 8px; }
.card { padding: 16px 16px 12px; border-radius: var(--md-sys-shape-corner-large); background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.t { margin: 0 0 4px; font: var(--md-sys-typescale-title-medium); }
.x { margin: 0; font: var(--md-sys-typescale-body-large); overflow-wrap: anywhere; }
.acts { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
</style>
