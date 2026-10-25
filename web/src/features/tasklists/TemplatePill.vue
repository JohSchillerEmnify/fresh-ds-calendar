<script setup lang="ts">
/**
 * "From template ▾" (feature tasklist-templates, owner's design canvas 2026-10-25): a tonal pill next to the new task
 * list form's heading. A tap grows the pill in place into the template menu (container transform: the menu is clipped
 * to the pill's shape and opens out from its top-right corner to a rounded panel). The menu lists the templates, each
 * with a details line ("2 items · ~45 min · Home"), then a divider and "Manage templates". After a pick the pill shows
 * the template's name. Full motion grows; Reduced fades; Off just shows.
 */
import { computed, nextTick, onBeforeUnmount, ref } from 'vue';
import type { TaskTemplate } from '@/api/types';
import { t } from '@/i18n';
import { IconKeyboardArrowDown as IconDown } from '@/components/icons';
import { animate, finished } from '@/motion';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import { formatEstimate } from './format';
import { useTaskCategories } from './categories';
import { templateDetails } from './templates';
import { useTemplatesStore } from './templatesStore';

defineProps<{ picked: string | null }>();
const emit = defineEmits<{ pick: [tpl: TaskTemplate]; manage: [] }>();
const templates = useTemplatesStore();
const settings = useSettingsStore();
const cats = useTaskCategories();
const ui = useUiStore();

const open = ref(false);
const pill = ref<HTMLButtonElement | null>(null);
const panel = ref<HTMLElement | null>(null);
let closing = false;

const rows = computed(() => templates.list.map((tpl) => ({
  tpl,
  details: templateDetails(tpl, cats.on.value ? settings.categoryById(tpl.categoryId)?.name ?? null : null, {
    items: (n) => t('tasks.templates.itemCount', { count: n }, n),
    estimate: formatEstimate,
  }),
})));

/** The clip that shows only the pill's shape, measured from the panel's top-right corner. */
function pillClip(): string | null {
  const p = pill.value?.getBoundingClientRect();
  const m = panel.value?.getBoundingClientRect();
  if (!p || !m) return null;
  return `inset(0px 0px ${Math.max(0, m.height - p.height)}px ${Math.max(0, m.width - p.width)}px round ${p.height / 2}px)`;
}

async function show(): Promise<void> {
  if (open.value) return;
  open.value = true;
  document.addEventListener('pointerdown', outside, true);
  templates.load().catch(() => ui.notify(t('tasks.templates.loadFailed')));
  await nextTick();
  grow();
  // the menu takes the focus (Escape closes it) without marking an entry as chosen
  panel.value?.focus({ preventScroll: true });
}
/** Grows the menu out of the pill (Full), fades it in (Reduced) or shows it (Off). */
function grow(): void {
  const from = pillClip();
  if (!from) return;
  animate(panel.value, [
    { clipPath: from, backgroundColor: 'var(--md-sys-color-secondary-container)' },
    { clipPath: 'inset(0px 0px 0px 0px round 16px)', backgroundColor: 'var(--md-sys-color-surface-container-high)' },
  ], { duration: 320, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
  animate(panel.value?.querySelector('.content'), [{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1 }], { duration: 320, reduced: 'skip' });
}
/** Shrinks the menu back into the pill, then removes it. */
async function hide(focusPill = false): Promise<void> {
  if (!open.value || closing) return;
  closing = true;
  document.removeEventListener('pointerdown', outside, true);
  const to = pillClip();
  if (to) {
    await finished(animate(panel.value, [
      { clipPath: 'inset(0px 0px 0px 0px round 16px)', backgroundColor: 'var(--md-sys-color-surface-container-high)' },
      { clipPath: to, backgroundColor: 'var(--md-sys-color-secondary-container)' },
    ], { duration: 220, easing: 'cubic-bezier(0.3, 0, 0.8, 0.15)', reduced: 'skip' }));
  }
  open.value = false;
  closing = false;
  if (focusPill) pill.value?.focus({ preventScroll: true });
}
function outside(e: PointerEvent): void {
  if (!panel.value?.contains(e.target as Node)) void hide();
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
    <button
      ref="pill" v-ripple type="button" class="pill" :class="{ hidden: open }" aria-haspopup="menu" :aria-expanded="open"
      data-testid="tasklist-from-template" @click="show"
    >
      <span class="lab" data-testid="tasklist-from-template-label">{{ picked ?? t('tasks.templates.fromTemplate') }}</span>
      <IconDown class="caret" aria-hidden="true" />
    </button>
    <div
      v-if="open" ref="panel" class="menu" role="menu" tabindex="-1" :aria-label="t('tasks.templates.menu')" data-testid="template-picker"
      @keydown.esc.stop.prevent="hide(true)"
    >
      <div class="content">
        <button
          v-for="r in rows" :key="r.tpl.id" type="button" role="menuitem" class="item" data-testid="template-picker-item"
          :data-name="r.tpl.name" :data-count="r.tpl.items.length" @click="choose(r.tpl)"
        >
          <span class="name" data-testid="template-picker-name">{{ r.tpl.name }}</span>
          <span class="details" data-testid="template-picker-details">{{ r.details }}</span>
        </button>
        <p v-if="templates.loaded && !rows.length" class="empty" data-testid="template-picker-empty">{{ t('tasks.templates.empty') }}</p>
        <hr class="divider" data-testid="template-picker-divider" />
        <button type="button" role="menuitem" class="item manage" data-testid="template-picker-manage" @click="manage">{{ t('tasks.templates.manage') }}</button>
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
/* the menu opens from the pill's top-right corner, so it stays inside the sheet on a phone */
.menu {
  position: absolute; top: 0; right: 0; z-index: 5; width: min(300px, calc(100vw - 48px)); max-height: min(60vh, 420px); overflow-y: auto;
  border-radius: 16px; background: var(--md-sys-color-surface-container-high); color: var(--md-sys-color-on-surface);
  box-shadow: 0 2px 6px rgb(0 0 0 / 0.18), 0 8px 24px rgb(0 0 0 / 0.12);
}
.menu:focus { outline: 0; }
.content { display: flex; flex-direction: column; padding: 6px 0; }
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
