<script setup lang="ts">
import IconAdd from '~icons/material-symbols/add';
import Fab from '@/components/m3/Fab.vue';
import Menu from '@/components/m3/Menu.vue';
import { createContext } from '@/extensions/create';
import { createActions } from '@/extensions/registry';
import { useUiStore } from '@/stores/ui';
import { computed } from 'vue';

/** FAB + its menu. Entries come from `createActions` (extensions/registry.ts). */
const ui = useUiStore();
const items = computed(() => createActions.map((a) => ({ id: a.id, label: a.label, icon: a.icon, testid: a.testid })));
function select(id: string) {
  ui.createMenuOpen = false;
  createActions.find((a) => a.id === id)?.run(createContext());
}
</script>

<template>
  <div class="fab-wrap" data-testid="create-fab-area">
    <div v-if="ui.createMenuOpen" class="scrim" @click="ui.createMenuOpen = false" />
    <Menu :open="ui.createMenuOpen" :items="items" label="Create" testid="create-menu" @close="ui.createMenuOpen = false" @select="select" />
    <Fab label="Create" data-testid="create-button" :expanded="ui.createMenuOpen" @click="ui.createMenuOpen = !ui.createMenuOpen"><IconAdd /></Fab>
  </div>
</template>

<style scoped>
.fab-wrap {
  position: fixed; right: calc(16px + var(--safe-right)); bottom: calc(var(--navbar-h) + var(--safe-bottom) + 12px); /* phone: floats over the tray bar (its toggle keeps clear), inside thumb reach */
  z-index: 30; display: flex; flex-direction: column; align-items: flex-end; gap: 12px;
}
@media (min-width: 768px) { .fab-wrap { bottom: 24px; right: 24px; } }
.scrim { position: fixed; inset: 0; z-index: -1; background: rgb(0 0 0 / 0.2); }
</style>
