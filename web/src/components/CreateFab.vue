<script setup lang="ts">
import { useCalendarStore } from '@/stores/calendar';
import IconAdd from '~icons/material-symbols/add-rounded';
const store = useCalendarStore();
</script>

<template>
  <button class="fab" aria-label="Create" data-testid="fab-create" @click="store.createSheetOpen = true">
    <IconAdd aria-hidden="true" />
  </button>
</template>

<style scoped>
.fab {
  position: fixed; z-index: 20;
  right: 16px; bottom: calc(var(--tabbar-h) + var(--safe-bottom) + 16px);
  width: 56px; height: 56px; border-radius: var(--md-sys-shape-corner-large);
  background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container);
  box-shadow: var(--shadow);
  display: flex; align-items: center; justify-content: center;
}
.fab svg { width: 24px; height: 24px; }
</style>
