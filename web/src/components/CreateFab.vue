<script setup lang="ts">
import { useCalendarStore } from '@/stores/calendar';
const store = useCalendarStore();
</script>

<template>
  <button class="fab" aria-label="Create" data-testid="fab-create" @click="store.createSheetOpen = true">
    <svg viewBox="0 0 36 36" aria-hidden="true">
      <path fill="#34A853" d="M16 16v14h4V20z" />
      <path fill="#4285F4" d="M30 16H20l-4 4h14z" />
      <path fill="#FBBC05" d="M6 16v4h10l4-4z" />
      <path fill="#EA4335" d="M20 16V6h-4v14z" />
    </svg>
  </button>
</template>

<style scoped>
.fab {
  position: fixed; z-index: 20;
  right: 16px; bottom: calc(var(--tabbar-h) + var(--safe-bottom) + 16px);
  width: 56px; height: 56px; border-radius: 16px;
  background: var(--surface); box-shadow: var(--shadow);
  display: flex; align-items: center; justify-content: center;
}
.fab svg { width: 36px; height: 36px; }
</style>
