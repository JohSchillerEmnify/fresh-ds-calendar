<script setup lang="ts">
import IconSync from '~icons/material-symbols/sync';
import IconProblem from '~icons/material-symbols/sync-problem';
import { useSyncStore } from '@/stores/sync';

const sync = useSyncStore();
</script>

<template>
  <span class="status" role="status" data-testid="sync-status" :data-state="sync.state" :data-last-sync="sync.lastSync ?? ''" :aria-label="sync.state === 'error' ? 'Sync problem' : sync.state === 'syncing' ? 'Syncing' : 'Synced'">
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
