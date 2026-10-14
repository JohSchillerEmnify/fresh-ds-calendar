<script setup lang="ts">
import { IconSync, IconSyncProblem as IconProblem } from '@/components/icons';
import { useSyncStore } from '@/stores/sync';
import { t } from '@/i18n';

const sync = useSyncStore();
</script>

<template>
  <span class="status" role="status" data-testid="sync-status" :data-state="sync.state" :data-rate-limited="sync.rateLimited || undefined" :data-last-sync="sync.lastSync ?? ''" :aria-label="sync.state === 'error' ? t('calendar.sync.problem') : sync.state === 'syncing' ? t('calendar.sync.syncing') : t('calendar.sync.synced')">
    <component :is="sync.state === 'error' ? IconProblem : IconSync" :class="{ spin: sync.state === 'syncing' }" />
  </span>
</template>

<style scoped>
.status { width: 28px; height: 44px; display: inline-flex; align-items: center; justify-content: center; color: var(--md-sys-color-on-surface-variant); opacity: 0.7; }
.status[data-state='error'] { color: var(--md-sys-color-error); opacity: 1; }
.status svg { width: 20px; height: 20px; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
