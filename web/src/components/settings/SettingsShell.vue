<script setup lang="ts">
/** The frame of every settings page: Back, title and rows; a `focus` query (a chosen search result) scrolls to that row and highlights it. */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IconArrowBack as IconBack } from '@/components/icons';
import IconButton from '@/components/m3/IconButton.vue';
import { t } from '@/i18n';
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
    <header class="bar">
      <IconButton :label="t('settings.back')" data-testid="settings-back" @click="back"><IconBack /></IconButton>
      <h1>{{ title }}</h1>
    </header>
    <div ref="body" class="content"><slot /></div>
  </section>
</template>

<style scoped>
.page { height: 100%; overflow-y: auto; overflow-x: clip; background: var(--md-sys-color-surface); padding-bottom: calc(24px + var(--safe-bottom)); }
.bar { display: flex; align-items: center; gap: 4px; padding: calc(var(--safe-top) + 8px) 8px 8px; position: sticky; top: 0; background: var(--md-sys-color-surface); z-index: 2; }
h1 { margin: 0; font: var(--md-sys-typescale-title-large); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.content { display: flex; flex-direction: column; gap: 4px; padding: 4px 8px 0; max-width: 640px; width: 100%; margin: 0 auto; box-sizing: border-box; }
.content :deep(h2) { margin: 0; padding: 20px 16px 4px; font: var(--md-sys-typescale-title-small); color: var(--md-sys-color-primary); }
.content :deep(.note) { margin: 0; padding: 4px 16px; font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
</style>
