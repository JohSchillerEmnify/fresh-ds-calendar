<script setup lang="ts">
/**
 * A sample entry for the theme menu: an event chip or a task list card, drawn with the shared `.skin`
 * of the calendar, so it follows whatever theme attributes sit on an ancestor (`<html>` or a scoped container).
 */
withDefaults(defineProps<{ kind: 'event' | 'tasklist'; color?: string; on?: string; title?: string }>(), {
  color: '#1a73e8', on: '#ffffff', title: 'Dentist',
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
</template>

<style scoped>
.s-ev { display: inline-flex; align-items: center; gap: 8px; min-width: 0; max-width: 100%; padding: 3px 9px; font: var(--md-sys-typescale-label-medium); box-sizing: border-box; }
.s-tl { display: flex; flex-direction: column; gap: 1px; min-width: 0; padding: 4px 9px; font: var(--md-sys-typescale-label-medium); box-sizing: border-box; border-radius: var(--r-block); }
.r { display: flex; align-items: center; gap: 5px; }
.t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1; }
.m { flex: none; font-size: 11px; opacity: 0.85; font-variant-numeric: tabular-nums; }
.it { display: flex; align-items: center; gap: 5px; font-size: 11px; line-height: 14px; opacity: 0.9; }
.cb { flex: none; width: 10px; height: 10px; box-sizing: border-box; border: 1.5px solid var(--on); border-radius: var(--cb-r, 3px); }
.cb.done { background: var(--on); }
</style>
