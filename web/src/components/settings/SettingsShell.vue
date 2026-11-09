<script setup lang="ts">
/** The frame of every settings page: Back, title and rows; a `focus` query (a chosen search result) scrolls to that row and highlights it. */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SettingsBar from '@/components/settings/SettingsBar.vue';
import { appTimeout, type Disposer } from '@/lib/timers';

const props = defineProps<{ title: string; up: string }>();
const route = useRoute();
const router = useRouter();
const body = ref<HTMLElement | null>(null);
let stop: Disposer | null = null;

/** Back in the history when the page was reached from inside the app, otherwise up to the parent page. */
function back() {
  if (window.history.state?.back) router.back();
  else void router.push(props.up);
}

/** Rows may appear only after the stores loaded: look a few times before giving up. */
function flash(id: string, tries = 10) {
  const row = body.value?.querySelector<HTMLElement>(`[data-setting-id="${CSS.escape(id)}"]`);
  if (!row) {
    if (tries > 0) stop = appTimeout(() => flash(id, tries - 1), 100);
    return;
  }
  row.scrollIntoView({ block: 'center' });
  row.setAttribute('data-flash', '');
  stop = appTimeout(() => row.removeAttribute('data-flash'), 2000);
}

onMounted(() => watch(() => route.query.focus, (f) => { stop?.(); if (typeof f === 'string') flash(f); }, { immediate: true }));
onBeforeUnmount(() => stop?.());
</script>

<template>
  <section class="page" data-testid="settings-view">
    <SettingsBar :title="title" @back="back" />
    <div ref="body" class="content"><slot /></div>
  </section>
</template>

<style scoped>
.page { height: 100%; overflow-y: auto; overflow-x: clip; background: var(--md-sys-color-surface); padding-bottom: calc(24px + var(--safe-bottom)); }
.content { display: flex; flex-direction: column; gap: 12px; padding: 4px 12px 0; max-width: 640px; width: 100%; margin: 0 auto; box-sizing: border-box; }
.content :deep(.note) { margin: 0; padding: 4px 16px; font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
</style>
