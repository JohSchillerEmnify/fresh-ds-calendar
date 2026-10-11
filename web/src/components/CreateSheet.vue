<script setup lang="ts">
import { useCalendarStore } from '@/stores/calendar';
const store = useCalendarStore();
</script>

<template>
  <Transition name="sheet">
    <div v-if="store.createSheetOpen" class="backdrop" data-testid="create-sheet-backdrop" @click.self="store.createSheetOpen = false">
      <section class="sheet" role="dialog" aria-modal="true" aria-label="Create" data-testid="create-sheet">
        <div class="grabber" />
        <h2>Create</h2>
        <ul>
          <li><span class="dot event" />Event <em>coming soon</em></li>
          <li><span class="dot tasks" />Task list <em>coming soon</em></li>
        </ul>
        <button class="close" data-testid="create-sheet-close" @click="store.createSheetOpen = false">Close</button>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.backdrop { position: fixed; inset: 0; z-index: 30; background: rgba(0, 0, 0, 0.32); display: flex; align-items: flex-end; justify-content: center; }
.sheet {
  width: 100%; max-width: 560px;
  background: var(--surface); color: var(--text);
  border-radius: 16px 16px 0 0;
  padding: 8px 20px calc(20px + var(--safe-bottom));
}
.grabber { width: 32px; height: 4px; border-radius: 2px; background: var(--border); margin: 0 auto 12px; }
h2 { margin: 0 0 8px; font-size: 18px; font-weight: 500; }
ul { list-style: none; margin: 0 0 16px; padding: 0; }
li { display: flex; align-items: center; gap: 12px; padding: 12px 0; font-size: 16px; border-bottom: 1px solid var(--border); }
em { margin-left: auto; font-size: 13px; color: var(--text-2); font-style: normal; }
.dot { width: 12px; height: 12px; border-radius: 50%; }
.dot.event { background: #1a73e8; }
.dot.tasks { background: #33b679; }
.close { width: 100%; height: 44px; border-radius: 22px; background: var(--accent); color: var(--accent-contrast); font-weight: 500; }
.sheet-enter-active, .sheet-leave-active { transition: opacity 0.2s; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
</style>
