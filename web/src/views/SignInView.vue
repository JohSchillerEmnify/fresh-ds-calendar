<script setup lang="ts">
import { useRoute } from 'vue-router';
import Button from '@/components/m3/Button.vue';
import { t } from '@/i18n';

const route = useRoute();
const isPrivate = route.query.error === 'private';

/** A full navigation: the OAuth round trip leaves the SPA. */
function signIn() {
  window.location.assign('/api/auth/google/start');
}
</script>

<template>
  <section class="page" data-testid="signin-page">
    <h1>{{ t('calendar.signIn.title') }}</h1>
    <p v-if="isPrivate" class="notice" role="alert" data-testid="signin-private">{{ t('calendar.signIn.privateCalendar') }}</p>
    <p v-else class="hint">{{ t('calendar.signIn.hint') }}</p>
    <Button data-testid="signin-google" @click="signIn">{{ t('calendar.signIn.withGoogle') }}</Button>
  </section>
</template>

<style scoped>
.page { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 24px; text-align: center; background: var(--md-sys-color-surface); color: var(--md-sys-color-on-surface); }
h1 { margin: 0; font: var(--md-sys-typescale-headline-medium); }
p { margin: 0; max-width: 320px; font: var(--md-sys-typescale-body-large); }
.notice { color: var(--md-sys-color-error); }
.hint { color: var(--md-sys-color-on-surface-variant); }
</style>
