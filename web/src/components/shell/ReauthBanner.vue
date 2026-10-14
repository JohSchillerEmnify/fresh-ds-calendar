<script setup lang="ts">
import { IconCloudOff as IconOff } from '@/components/icons';
import Button from '@/components/m3/Button.vue';
import { useAuthStore } from '@/stores/auth';
import { t } from '@/i18n';

const auth = useAuthStore();
const signIn = () => window.location.assign('/api/auth/google/start');
</script>

<template>
  <div v-if="auth.reauth" class="banner" role="alert" data-testid="reauth-banner">
    <IconOff class="ico" aria-hidden="true" />
    <span class="msg">{{ t('calendar.reauth.message') }}</span>
    <Button variant="text" data-testid="reauth-signin" @click="signIn">{{ t('calendar.reauth.signIn') }}</Button>
  </div>
  <div v-else-if="auth.calendarMissing" class="banner" role="alert" data-testid="calendar-access-banner">
    <IconOff class="ico" aria-hidden="true" />
    <span class="msg">{{ t('calendar.calendarAccess.message') }}</span>
    <Button variant="text" data-testid="calendar-access-grant" @click="auth.grantCalendar()">{{ t('calendar.calendarAccess.grant') }}</Button>
  </div>
</template>

<style scoped>
.banner {
  display: flex; align-items: center; gap: 10px; padding: 4px 8px 4px 16px; min-height: 52px; flex: none;
  background: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container); font: var(--md-sys-typescale-body-medium);
}
.msg { flex: 1; min-width: 0; }
.ico { width: 22px; height: 22px; flex: none; }
.banner :deep(.m3-btn) { color: var(--md-sys-color-on-error-container); }
</style>
