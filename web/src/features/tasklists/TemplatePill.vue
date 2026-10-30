<script setup lang="ts">
/**
 * "From template ▾" (feature tasklist-templates, owner's design canvas 2026-10-25, variant 4D): a tonal pill next to
 * the new task list form's heading. A tap grows the pill in place into a panel whose top row is the pill itself
 * ("From template ▴", exactly where the pill was), then the templates, each with a details line ("2 items · ~45 min ·
 * Home"), a divider and "Manage templates". After a pick the pill shows the template's name. The panel is only as wide
 * as its content needs. Full motion scales it out of the pill's corner (transform and opacity only); Reduced fades;
 * Off just shows. Escape, a tap outside, the header pill or Tab leaving the panel close it.
 */
import Pressable from '@/components/m3/Pressable.vue';
import { elOf } from '@/lib/elOf';
import { computed, nextTick, onBeforeUnmount, ref } from 'vue';
import type { TaskTemplate } from '@/api/types';
import { t } from '@/i18n';
import { IconKeyboardArrowDown as IconDown, IconKeyboardArrowUp as IconUp } from '@/components/icons';
import { animate, finished } from '@/motion';
import { useSettingsStore } from '@/stores/settings';
import { formatEstimate } from './format';
import { useTaskCategories } from './categories';
import { templateDetails } from './templates';
import { useTemplatesStore } from './templatesStore';

const props = defineProps<{ picked: string | null }>();
const emit = defineEmits<{ pick: [tpl: TaskTemplate]; manage: [] }>();
const templates = useTemplatesStore();
const settings = useSettingsStore();
const cats = useTaskCategories();

const open = ref(false);
const pillRef = ref<unknown>(null);
/** The `Pressable`'s element (a template ref points at the component). */
const pill = computed(() => elOf(pillRef.value) as HTMLButtonElement | null);
const panel = ref<HTMLElement | null>(null);
let closing = false;
const label = computed(() => props.picked ?? t('tasks.templates.fromTemplate'));

const rows = computed(() => templates.list.map((tpl) => ({
  tpl,
  details: templateDetails(tpl, cats.on.value ? settings.categoryById(tpl.categoryId)?.name ?? null : null, {
    items: (n) => t('tasks.templates.itemCount', { count: n }, n),
    estimate: formatEstimate,
  }),
})));

/** The panel's scale at which it is exactly the pill (it grows from and shrinks to the pill's top-right corner). */
function pillScale(): { x: number; y: number } | null {
  const p = pill.value?.getBoundingClientRect();
  const m = panel.value?.getBoundingClientRect();
  if (!p || !m || !m.width || !m.height) return null;
  return { x: p.width / m.width, y: p.height / m.height };
}
/** Panel and header frames from the pill to the open panel (or back); the header is scaled back so it keeps the pill's look. */
function frames(s: { x: number; y: number }, opening: boolean): { panelF: Keyframe[]; headF: Keyframe[] } {
  const panelF = [{ transform: `scale(${s.x}, ${s.y})` }, { transform: 'scale(1, 1)' }];
  const headF = [{ transform: `scale(${1 / s.x}, ${1 / s.y})` }, { transform: 'scale(1, 1)' }];
  return opening ? { panelF, headF } : { panelF: panelF.reverse(), headF: headF.reverse() };
}

async function show(): Promise<void> {
  if (open.value) return;
  open.value = true;
  document.addEventListener('pointerdown', outside, true);
  templates.load().catch(() => undefined);
  await nextTick();
  const s = pillScale();
  if (s) {
    const { panelF, headF } = frames(s, true);
    const timing = { duration: 320, easing: 'cubic-bezier(0.2, 0, 0, 1)' };
    animate(panel.value, panelF, timing);
    animate(panel.value?.querySelector('.head'), headF, { ...timing, reduced: 'skip' });
    animate(panel.value?.querySelector('.content'), [{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1 }], { ...timing, reduced: 'skip' });
  }
  // the panel takes the focus (Escape closes it) without marking an entry as chosen
  panel.value?.focus({ preventScroll: true });
}
/** Shrinks the panel back into the pill, then removes it; `focusPill` gives the focus back to the pill. */
async function hide(focusPill = false): Promise<void> {
  if (!open.value || closing) return;
  closing = true;
  document.removeEventListener('pointerdown', outside, true);
  const s = pillScale();
  if (s) {
    const { panelF, headF } = frames(s, false);
    const timing = { duration: 220, easing: 'cubic-bezier(0.3, 0, 0.8, 0.15)', reduced: 'skip' as const };
    animate(panel.value?.querySelector('.content'), [{ opacity: 1 }, { opacity: 0, offset: 0.5 }, { opacity: 0 }], timing);
    animate(panel.value?.querySelector('.head'), headF, timing);
    await finished(animate(panel.value, panelF, timing));
  }
  open.value = false;
  closing = false;
  if (focusPill) {
    // the pill is shown again only after the next render
    await nextTick();
    pill.value?.focus({ preventScroll: true });
  }
}
function outside(e: PointerEvent): void {
  if (!panel.value?.contains(e.target as Node)) void hide();
}
/** Tab out of the panel closes it, so the focus never goes on under the open panel. */
function focusOut(e: FocusEvent): void {
  const to = e.relatedTarget as Node | null;
  if (to && !panel.value?.contains(to)) void hide();
}
function choose(tpl: TaskTemplate): void {
  emit('pick', tpl);
  void hide(true);
}
function manage(): void {
  void hide();
  emit('manage');
}
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside, true));
defineExpose({ open });
</script>

<template>
  <div class="tp">
    <Pressable
      ref="pillRef" v-ripple type="button" class="pill" :class="{ hidden: open }" aria-haspopup="true" :aria-expanded="open"
      data-testid="tasklist-from-template" @click="show"
    >
      <span class="lab" data-testid="tasklist-from-template-label">{{ label }}</span>
      <IconDown class="caret" aria-hidden="true" />
    </Pressable>
    <div
      v-if="open" ref="panel" class="menu" role="group" tabindex="-1" :aria-label="t('tasks.templates.menu')" data-testid="template-picker"
      @keydown.esc.stop.prevent="hide(true)" @focusout="focusOut"
    >
      <div class="head">
        <Pressable type="button" class="pill" aria-expanded="true" data-testid="template-picker-header" @click="hide(true)">
          <span class="lab">{{ label }}</span>
          <IconUp class="caret" aria-hidden="true" />
        </Pressable>
      </div>
      <div class="content">
        <Pressable
          v-for="r in rows" :key="r.tpl.id" type="button" class="item" data-testid="template-picker-item"
          :data-name="r.tpl.name" :data-count="r.tpl.items.length" @click="choose(r.tpl)"
        >
          <span class="name" data-testid="template-picker-name">{{ r.tpl.name }}</span>
          <span class="details" data-testid="template-picker-details">{{ r.details }}</span>
        </Pressable>
        <p v-if="templates.loaded && !rows.length" class="empty" data-testid="template-picker-empty">{{ t('tasks.templates.empty') }}</p>
        <hr class="divider" data-testid="template-picker-divider" />
        <Pressable type="button" class="item manage" data-testid="template-picker-manage" @click="manage">{{ t('tasks.templates.manage') }}</Pressable>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tp { position: relative; flex: none; }
.pill {
  display: inline-flex; align-items: center; gap: 2px; min-height: 36px; max-width: 200px; padding: 0 8px 0 14px;
  border-radius: var(--md-sys-shape-corner-full); background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container); font: var(--md-sys-typescale-label-large); position: relative; overflow: hidden;
}
.pill.hidden { visibility: hidden; }
.lab { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.caret { flex: none; width: 20px; height: 20px; }
/* the panel opens from the pill's top-right corner (its header pill stands exactly where the pill was) and is only as
   wide as its entries need */
.menu {
  position: absolute; top: 0; right: 0; z-index: 5; width: max-content; min-width: 100%; max-width: min(300px, calc(100vw - 48px));
  max-height: min(60vh, 420px); overflow-y: auto; transform-origin: top right;
  border-radius: 18px; background: var(--md-sys-color-surface-container-high); color: var(--md-sys-color-on-surface);
  box-shadow: 0 2px 6px rgb(0 0 0 / 0.18), 0 8px 24px rgb(0 0 0 / 0.12);
}
.menu:focus { outline: 0; }
.head { display: flex; justify-content: flex-end; transform-origin: top right; }
.content { display: flex; flex-direction: column; padding: 2px 0 6px; }
.item { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-height: 48px; padding: 8px 16px; text-align: left; }
.item:focus-visible { background: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent); outline: 0; }
/* a finger leaves no hover behind on a phone: only a real pointer highlights the entry under it */
@media (hover: hover) { .item:hover { background: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent); } }
.name { font: var(--md-sys-typescale-body-large); overflow-wrap: anywhere; }
.details { font: var(--md-sys-typescale-body-small); color: var(--md-sys-color-on-surface-variant); }
.empty { margin: 8px 16px; font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
.divider { margin: 4px 0; border: 0; border-top: 1px solid var(--md-sys-color-outline-variant); }
.manage { justify-content: center; color: var(--md-sys-color-primary); font: var(--md-sys-typescale-label-large); }
</style>
