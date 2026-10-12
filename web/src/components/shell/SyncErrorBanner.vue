<script setup lang="ts">
import IconOff from '~icons/material-symbols/cloud-off';
import Button from '@/components/m3/Button.vue';
import { useSyncStore } from '@/stores/sync';

const sync = useSyncStore();
</script>

<template>
  <div v-if="sync.error" class="banner" role="alert" data-testid="sync-error-banner">
    <IconOff class="ico" aria-hidden="true" />
    <span class="msg">{{ sync.errorMessage }}</span>
    <Button variant="text" data-testid="sync-retry" @click="sync.retry()">Retry</Button>
  </div>
</template>

<style scoped>
.banner {
  display: flex; align-items: center; gap: 10px; padding: 4px 8px 4px 16px; min-height: 52px; flex: none;
  background: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container); font: var(--md-sys-typescale-body-medium);
  animation: slide 300ms var(--md-sys-motion-spring) both;
}
.msg { flex: 1; min-width: 0; }
.ico { width: 22px; height: 22px; flex: none; }
.banner :deep(.m3-btn) { color: var(--md-sys-color-on-error-container); }
@keyframes slide { from { transform: translateY(-100%); opacity: 0; } }
</style>
