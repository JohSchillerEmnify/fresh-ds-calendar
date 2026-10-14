<script setup lang="ts">
/** Release notes sheet (ARCHITECTURE "Release notes"): the plain-English lines of CHANGELOG.md, grouped by day, newest first. */
import { computed, onMounted, ref } from 'vue';
import { api } from '@/api/client';
import type { ReleaseNote } from '@/api/types';
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';
import Button from '@/components/m3/Button.vue';
import { t } from '@/i18n';

const emit = defineEmits<{ close: [] }>();
const notes = ref<ReleaseNote[]>([]);
const loaded = ref(false);

// consecutive notes of one date form a day; the server already sorted newest first
const days = computed(() => {
  const out: { date: string; notes: ReleaseNote[] }[] = [];
  for (const n of notes.value) {
    const last = out[out.length - 1];
    if (last && last.date === n.date) last.notes.push(n);
    else out.push({ date: n.date, notes: [n] });
  }
  return out;
});

onMounted(async () => {
  try { notes.value = (await api.releaseNotes()).notes; } catch { /* offline: the empty text shows */ }
  loaded.value = true;
});
</script>

<template>
  <AdaptiveSheet :open="true" :label="t('calendar.whatsNew.title')" testid="whats-new" @close="emit('close')">
    <div class="f">
      <h2 class="t">{{ t('calendar.whatsNew.title') }}</h2>
      <p v-if="loaded && !days.length" class="empty" data-testid="whats-new-empty">{{ t('calendar.whatsNew.empty') }}</p>
      <section v-for="d in days" :key="d.date" class="day" data-testid="whats-new-day" :data-date="d.date">
        <h3 class="d">{{ d.date }}</h3>
        <ul class="list">
          <li v-for="n in d.notes" :key="n.id" data-testid="whats-new-item">{{ n.text }}</li>
        </ul>
      </section>
      <div class="actions"><Button data-testid="whats-new-close" @click="emit('close')">{{ t('calendar.whatsNew.close') }}</Button></div>
    </div>
  </AdaptiveSheet>
</template>

<style scoped>
.f { display: flex; flex-direction: column; gap: 12px; }
.t { margin: 8px 0 0; font: var(--md-sys-typescale-title-large); }
.empty { margin: 0; font: var(--md-sys-typescale-body-large); color: var(--md-sys-color-on-surface-variant); }
.d { margin: 0 0 4px; font: var(--md-sys-typescale-label-large); color: var(--md-sys-color-on-surface-variant); }
.list { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; font: var(--md-sys-typescale-body-large); }
.actions { display: flex; justify-content: flex-end; margin-top: 4px; }
html[data-hand='left'] .actions { justify-content: flex-start; }
</style>
