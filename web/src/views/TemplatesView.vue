<script setup lang="ts">
/**
 * Settings › Task lists › Templates (`/settings/templates`, feature tasklist-templates): every task list template by
 * name with its details line, "New template" on top (also in the empty state), a tap opens the template sheet to change
 * name, items, estimate and category; delete goes through the undo snackbar like the app's other deletes.
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IconAdd, IconArrowBack as IconBack, IconDeleteOutline as IconDelete } from '@/components/icons';
import type { TaskTemplate } from '@/api/types';
import Button from '@/components/m3/Button.vue';
import IconButton from '@/components/m3/IconButton.vue';
import { t } from '@/i18n';
import { formatEstimate } from '@/features/tasklists/format';
import { useTaskCategories } from '@/features/tasklists/categories';
import TemplateDialog from '@/features/tasklists/TemplateDialog.vue';
import { templateDetails } from '@/features/tasklists/templates';
import { useTemplatesStore } from '@/features/tasklists/templatesStore';
import { usePendingDeletesStore } from '@/stores/pendingDeletes';
import { useSettingsStore } from '@/stores/settings';

const router = useRouter();
const templates = useTemplatesStore();
const pending = usePendingDeletesStore();
const settings = useSettingsStore();
const cats = useTaskCategories();

/** The sheet: a template being edited, 'new' for a new one, null when closed. */
const editing = ref<TaskTemplate | 'new' | null>(null);
const rows = computed(() => templates.list.map((tpl) => ({
  tpl,
  details: templateDetails(tpl, cats.on.value ? settings.categoryById(tpl.categoryId)?.name ?? null : null, {
    items: (n) => t('tasks.templates.itemCount', { count: n }, n),
    estimate: formatEstimate,
  }),
})));

// offline the page says so in place of the list (the templates are not kept on the device)
onMounted(() => { templates.load().catch(() => undefined); });

function back() {
  if (window.history.state?.back) router.back();
  else router.push('/settings');
}
</script>

<template>
  <section class="page" data-testid="templates-page">
    <header class="bar">
      <IconButton :label="t('settings.back')" data-testid="templates-back" @click="back"><IconBack /></IconButton>
      <h1>{{ t('tasks.templates.page') }}</h1>
    </header>
    <div class="content">
      <section class="card">
        <div class="top"><Button variant="tonal" data-testid="templates-new" @click="editing = 'new'"><template #icon><IconAdd /></template>{{ t('tasks.templates.newTemplate') }}</Button></div>
        <p v-if="!templates.loaded && templates.failed" class="sub empty" data-testid="templates-offline">{{ t('tasks.templates.offline') }}</p>
        <p v-else-if="templates.loaded && !rows.length" class="sub empty" data-testid="templates-empty">{{ t('tasks.templates.empty') }}</p>
        <ul v-else class="list">
          <li v-for="r in rows" :key="r.tpl.id" class="row" data-testid="template-row" :data-name="r.tpl.name">
            <button type="button" class="main" :aria-label="t('tasks.templates.edit', { name: r.tpl.name })" data-testid="template-open" @click="editing = r.tpl">
              <span class="lab">{{ r.tpl.name }}</span>
              <span class="sub">{{ r.details }}</span>
            </button>
            <IconButton :label="t('tasks.templates.delete', { name: r.tpl.name })" data-testid="template-delete" @click="pending.deleteTemplate(r.tpl.id, r.tpl.name)"><IconDelete /></IconButton>
          </li>
        </ul>
      </section>
    </div>
    <TemplateDialog v-if="editing" :key="editing === 'new' ? 'new' : editing.id" :template="editing === 'new' ? null : editing" @close="editing = null" />
  </section>
</template>

<style scoped>
.page { height: 100%; overflow-y: auto; overflow-x: clip; background: var(--md-sys-color-surface); padding-bottom: calc(24px + var(--safe-bottom)); }
.bar { display: flex; align-items: center; gap: 4px; padding: calc(var(--safe-top) + 8px) 8px 8px; position: sticky; top: 0; background: var(--md-sys-color-surface); z-index: 2; }
h1 { margin: 0; font: var(--md-sys-typescale-title-large); }
.content { display: flex; flex-direction: column; gap: 12px; padding: 4px 12px 0; max-width: 640px; margin: 0 auto; }
.card { background: var(--md-sys-color-surface-container-low); border-radius: var(--md-sys-shape-corner-extra-large); padding: 12px 8px; display: flex; flex-direction: column; gap: 4px; }
.top { display: flex; padding: 4px 8px 8px; }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.row { display: flex; align-items: center; gap: 4px; }
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-height: 56px; padding: 8px; text-align: left; color: inherit; border-radius: var(--md-sys-shape-corner-large); }
.main:hover { background: var(--md-sys-color-surface-container-high); }
.lab { font: var(--md-sys-typescale-body-large); overflow-wrap: anywhere; }
.sub { font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
.empty { margin: 4px 8px 8px; }
</style>
