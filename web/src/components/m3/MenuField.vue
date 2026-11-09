<script setup lang="ts" generic="T extends string">
/** A select as an outlined field with a floating label that opens an M3 menu card of options (the chosen one is marked). */
import { computed, nextTick, ref, useId } from 'vue';
import { IconCheck, IconExpandMore as IconExpand } from '@/components/icons';
import type { Option } from '@/components/m3/types';
import { useMenuNav } from '@/composables/useMenuNav';
import { vRipple } from '@/lib/ripple';

defineOptions({ inheritAttrs: false });
const props = defineProps<{ modelValue: T; options: Option<T>[]; label: string }>();
const emit = defineEmits<{ 'update:modelValue': [v: T] }>();
const open = ref(false);
const trigger = ref<HTMLElement | null>(null);
const panel = ref<HTMLElement | null>(null);
const listId = useId();
const current = computed(() => props.options.find((o) => o.value === props.modelValue)?.label ?? '');

/** Closes the menu; a keyboard dismissal gives focus back to the field. */
function close(refocus = false): void {
  open.value = false;
  if (refocus) trigger.value?.focus({ preventScroll: true });
}
/** Opens the menu and keeps it on screen, with the chosen option focused. */
async function toggle(): Promise<void> {
  if (open.value) return close();
  open.value = true;
  await nextTick();
  panel.value?.scrollIntoView?.({ block: 'nearest' });
}
function choose(v: T): void {
  close(true);
  if (v !== props.modelValue) emit('update:modelValue', v);
}
const { onKey } = useMenuNav({ open: () => open.value, panel, trigger, close, itemSelector: '[role="option"]', preferSelector: '[aria-selected="true"]' });
</script>

<template>
  <div class="fw" @keydown="onKey">
    <button
      ref="trigger" v-bind="$attrs" type="button" class="field" :class="{ open }" aria-haspopup="listbox" :aria-expanded="open" :aria-controls="open ? listId : undefined" @click="toggle"
    >
      <span class="lab">{{ label }}</span><span class="val">{{ current }}</span><IconExpand class="chev" aria-hidden="true" />
    </button>
    <div v-if="open" :id="listId" ref="panel" class="menu" role="listbox" :aria-label="label">
      <button v-for="o in options" :key="o.value" v-ripple type="button" class="opt" :class="{ on: o.value === modelValue }" role="option" :aria-selected="o.value === modelValue" @click="choose(o.value)">
        <span class="ck"><IconCheck v-if="o.value === modelValue" aria-hidden="true" /></span>{{ o.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.fw { position: relative; width: 100%; margin: 10px 0; }
.field {
  position: relative; display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; height: 56px; padding: 0 12px 0 16px; box-sizing: border-box;
  border: 1px solid var(--md-sys-color-outline); border-radius: var(--md-sys-shape-corner-small); text-align: left; font: var(--md-sys-typescale-body-large); color: var(--md-sys-color-on-surface);
}
.field.open, .field:focus-visible { border: 2px solid var(--md-sys-color-primary); padding: 0 11px 0 15px; outline: 0; }
.lab { position: absolute; top: -10px; left: 12px; padding: 0 4px; background: var(--md-sys-color-surface-container); font: var(--md-sys-typescale-label-medium); color: var(--md-sys-color-on-surface-variant); }
.open .lab { color: var(--md-sys-color-primary); }
.val { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chev { width: 24px; height: 24px; flex: none; color: var(--md-sys-color-on-surface-variant); }
.menu {
  position: absolute; left: 0; right: 0; top: 60px; z-index: 5; max-height: min(320px, 50vh); overflow-y: auto; padding: 8px 0;
  border-radius: var(--md-sys-shape-corner-small); background: var(--md-sys-color-surface-container-high); box-shadow: var(--md-sys-elevation-3);
}
.opt { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 48px; padding: 0 16px; text-align: left; font: var(--md-sys-typescale-body-large); color: var(--md-sys-color-on-surface); }
.opt.on { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.opt:focus-visible { outline: 0; background: var(--md-sys-color-surface-container-highest); }
.opt.on:focus-visible { background: var(--md-sys-color-secondary-container); box-shadow: inset 0 0 0 2px var(--md-sys-color-primary); }
.ck { display: inline-flex; width: 24px; height: 24px; flex: none; }
.ck :deep(svg) { width: 24px; height: 24px; }
</style>
