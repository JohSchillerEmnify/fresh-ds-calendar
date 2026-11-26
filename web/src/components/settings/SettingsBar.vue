<script setup lang="ts">
/** The expressive top bar of every settings page: a tonal Back button and a bold 28 px title; 64 px high, 56 px in the Compact top bar size. */
import { ref } from 'vue';
import { useElementSize } from '@vueuse/core';
import LastUpdatedNote from '@/components/shell/LastUpdatedNote.vue';
import ReauthBanner from '@/components/shell/ReauthBanner.vue';
import SyncErrorBanner from '@/components/shell/SyncErrorBanner.vue';
import { IconArrowBack as IconBack } from '@/components/icons';
import IconButton from '@/components/m3/IconButton.vue';
import { useBarSize } from '@/composables/useBarSize';
import { t } from '@/i18n';

withDefaults(defineProps<{ title: string; backTestid?: string }>(), { backTestid: 'settings-back' });
defineEmits<{ back: [] }>();
const barSize = useBarSize().top;
const slot = ref<HTMLElement | null>(null);
const stack = ref<HTMLElement | null>(null);
// the fixed stack is as wide as the slot (so a desktop scrollbar stays clear), measured rather than a container unit
const slotW = useElementSize(slot, undefined, { box: 'border-box' }).width;
// the page starts below the bar and the banners that sit under it
const stackH = useElementSize(stack, undefined, { box: 'border-box' }).height;
</script>

<template>
  <div ref="slot" class="slot" :data-size="barSize" :style="stackH ? { height: `${stackH}px` } : undefined">
    <div ref="stack" class="stack" :style="slotW ? { width: `${slotW}px` } : undefined">
      <header class="bar" data-testid="settings-bar" :data-size="barSize">
        <IconButton :label="t('settings.back')" variant="tonal" :data-testid="backTestid" @click="$emit('back')"><IconBack /></IconButton>
        <h1 data-testid="settings-title">{{ title }}</h1>
      </header>
      <ReauthBanner />
      <SyncErrorBanner />
      <LastUpdatedNote />
    </div>
  </div>
</template>

<style scoped>
/* the stack is fixed to the screen's top (not sticky inside the scrolling page) so iOS 26 tints the status area with its solid colour; the slot keeps its place in the page */
.slot { height: calc(var(--safe-top) + 64px); }
.slot[data-size='compact'] { height: calc(var(--safe-top) + 56px); }
.bar[data-size='compact'] { height: calc(var(--safe-top) + 56px); }
.bar { box-sizing: border-box; height: calc(var(--safe-top) + 64px); display: flex; align-items: center; gap: 12px; padding: var(--safe-top) 12px 0; background: var(--md-sys-color-surface); }
.stack { position: fixed; top: 0; width: 100%; z-index: 5; background: var(--md-sys-color-surface); }
h1 { margin: 0; font: 700 calc(28px * var(--dz, 1))/36px var(--font); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
