<script setup lang="ts">
/**
 * A sample entry for the theme menu: an event chip, a task list card or a checkbox, drawn with the shared `.skin`
 * of the calendar, so it follows whatever theme attributes sit on an ancestor (`<html>` or a scoped container).
 */
withDefaults(defineProps<{ kind: 'event' | 'tasklist' | 'checkbox'; color?: string; on?: string; title?: string; checked?: boolean }>(), {
  color: '#1a73e8', on: '#ffffff', title: 'Dentist', checked: false,
});
</script>

<template>
  <span v-if="kind === 'event'" class="skin s-ev" data-testid="theme-sample-event" :style="{ '--c': color, '--on-solid': on }">
    <span class="t">{{ title }}</span><span class="m">09:00</span>
  </span>
  <span v-else-if="kind === 'tasklist'" class="skin s-tl" :style="{ '--c': color, '--on-solid': on }">
    <span class="r"><i class="cb done" /><span class="t">{{ title }}</span><span class="m">1/3</span></span>
    <span class="it"><i class="cb done" />Milk</span>
    <span class="it"><i class="cb" />Bread</span>
  </span>
  <span v-else class="skin s-cb" :class="{ on: checked }" :style="{ '--c': color, '--on-solid': on }" role="img" aria-label="Checkbox">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" /></svg>
  </span>
</template>

<style scoped>
.s-ev { display: inline-flex; align-items: center; gap: 8px; min-width: 0; max-width: 100%; padding: 3px 9px; font: var(--md-sys-typescale-label-medium); box-sizing: border-box; }
.s-tl { display: flex; flex-direction: column; gap: 1px; min-width: 0; padding: 4px 9px; font: var(--md-sys-typescale-label-medium); box-sizing: border-box; border-radius: var(--r-block); }
.r { display: flex; align-items: center; gap: 5px; }
.t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1; }
.m { flex: none; font-size: 11px; opacity: 0.85; font-variant-numeric: tabular-nums; }
.it { display: flex; align-items: center; gap: 5px; font-size: 11px; line-height: 14px; opacity: 0.9; }
.cb { flex: none; width: 10px; height: 10px; box-sizing: border-box; border: 1.5px solid var(--on); border-radius: 3px; }
.cb.done { background: var(--on); }
.s-cb { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: var(--r-chip); box-sizing: border-box; }
.s-cb svg { width: 18px; height: 18px; opacity: 0; transition: opacity 150ms; }
.s-cb.on svg { opacity: 1; }
</style>
