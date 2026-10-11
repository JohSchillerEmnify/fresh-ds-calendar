<script setup lang="ts">
import TopBar from '@/components/TopBar.vue';
import BottomTabs from '@/components/BottomTabs.vue';
import CreateFab from '@/components/CreateFab.vue';
import CreateSheet from '@/components/CreateSheet.vue';
</script>

<template>
  <div class="shell" data-testid="app-shell">
    <TopBar />
    <main class="content" data-testid="view-container">
      <RouterView />
    </main>
    <CreateFab />
    <BottomTabs />
    <CreateSheet />
  </div>
</template>

<style scoped>
.shell { min-height: 100%; display: flex; flex-direction: column; }
.content {
  flex: 1; display: flex; flex-direction: column; min-height: 0;
  padding-bottom: calc(var(--tabbar-h) + var(--safe-bottom));
}
</style>
