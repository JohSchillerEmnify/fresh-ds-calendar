<script setup lang="ts">
/** One settings row, an M3 list item: name and supporting text first, the control at the end; `to` makes it open a page. */
import { useRouter } from 'vue-router';
import Pressable from '@/components/m3/Pressable.vue';
import { IconChevronRight as IconNext } from '@/components/icons';

const props = defineProps<{ id: string; label: string; hint?: string; to?: string; link?: boolean; value?: string; wide?: boolean;
  /** Test hook of the row's text (the row itself is `settings-row`) and of its value (`<testid>-name`). */
  testid?: string; valueTestid?: string }>();
const emit = defineEmits<{ open: [] }>();
const router = useRouter();
/** A link row opens its page, or tells the parent (a sheet). */
function open() {
  if (props.to) void router.push(props.to);
  else emit('open');
}
</script>

<template>
  <Pressable v-if="to !== undefined || link" class="row link" data-testid="settings-row" :data-setting="label" :data-setting-id="id" @click="open">
    <span class="text" :data-testid="testid"><span class="lab">{{ label }}</span><span v-if="hint" class="sub">{{ hint }}</span><slot name="sub" /></span>
    <span v-if="value" class="val" :data-testid="valueTestid">{{ value }}</span>
    <IconNext class="chev" aria-hidden="true" />
  </Pressable>
  <div v-else class="row" :class="{ wide }" data-testid="settings-row" :data-setting="label" :data-setting-id="id">
    <span class="text" :data-testid="testid"><span class="lab">{{ label }}</span><span v-if="hint" class="sub">{{ hint }}</span><slot name="sub" /></span>
    <span class="ctl"><slot /></span>
  </div>
</template>

<style scoped>
.row { display: flex; flex-wrap: wrap; align-items: center; column-gap: 16px; row-gap: 8px; padding: 10px 16px; min-height: 56px; width: 100%; text-align: left; color: inherit; border-radius: var(--md-sys-shape-corner-large); scroll-margin: 96px; }
.text { flex: 1 1 140px; min-width: 0; display: flex; flex-direction: column; }
.ctl { margin-left: auto; display: flex; align-items: center; gap: 8px; max-width: 100%; }
/* wide controls (segmented buttons, sliders) take a line of their own under the text, still ending at the row's end */
.wide .ctl { flex: 1 1 100%; justify-content: flex-end; }
/* segments take their label's width and break only between words when the row is narrow */
.wide .ctl :deep(.opt) { flex: 1 1 auto; overflow-wrap: normal; }
.lab { font: var(--md-sys-typescale-body-large); color: var(--md-sys-color-on-surface); }
.sub { font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
.val { font: var(--md-sys-typescale-label-large); color: var(--md-sys-color-on-surface-variant); max-width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chev { width: 24px; height: 24px; flex: none; color: var(--md-sys-color-on-surface-variant); }
/* touch screens: no hover state left behind after a tap */
@media (hover: hover) { .link:hover { background: var(--md-sys-color-surface-container-high); } }
.row[data-flash] { animation: flash 2s var(--md-sys-motion-easing-standard, ease) both; }
@keyframes flash { 0%, 60% { background: var(--md-sys-color-secondary-container); } 100% { background: transparent; } }
/* Left-handed mode (phone, touch tablet): the control at the left start of the row, the label after it. */
html[data-hand='left'][data-touch] .row:not(.link, .wide) { flex-direction: row-reverse; }
html[data-hand='left'][data-touch] .row:not(.link, .wide) .ctl { margin-left: 0; margin-right: auto; }
</style>
