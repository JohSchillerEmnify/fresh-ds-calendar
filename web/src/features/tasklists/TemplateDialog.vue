<script setup lang="ts">
/**
 * The template sheet of Settings › Task lists › Templates (feature tasklist-templates): "New template" (empty) or
 * "Edit template" with the name (required, free), the items one per line (so adding, removing, reordering and
 * retitling are all done by the lines, like the new task list form), the estimate and the category; Cancel / Save.
 * A template never has a date, time, repeat or reminders.
 */
import { computed, reactive, ref } from 'vue';
import { ApiError } from '@/api/client';
import type { TaskTemplate } from '@/api/types';
import { t } from '@/i18n';
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';
import Button from '@/components/m3/Button.vue';
import Select from '@/components/m3/Select.vue';
import TextField from '@/components/m3/TextField.vue';
import { useSettingsStore } from '@/stores/settings';
import { useTaskCategories } from './categories';
import { nameTaken } from './templates';
import { useTemplatesStore } from './templatesStore';
import { parseItems } from './validate';

/** `template`: the one being edited; null makes a new one. */
const props = defineProps<{ template: TaskTemplate | null }>();
const emit = defineEmits<{ close: [] }>();
const templates = useTemplatesStore();
const settings = useSettingsStore();
const cats = useTaskCategories();

const tpl = props.template;
const form = reactive({
  name: tpl?.name ?? '',
  items: tpl?.items.map((i) => i.title).join('\n') ?? '',
  estimate: tpl?.estimateMinutes ? String(tpl.estimateMinutes) : '',
  categoryId: tpl?.categoryId && settings.categoryById(tpl.categoryId) ? tpl.categoryId : 'none',
});
const original = JSON.stringify(form);
const dirty = computed(() => JSON.stringify(form) !== original);
const error = ref('');
const saving = ref(false);
const catOptions = computed(() => [{ value: 'none', label: t('tasks.noCategory') }, ...settings.categories.map((c) => ({ value: c.id, label: c.name }))]);
const title = computed(() => (tpl ? t('tasks.templates.editTemplate') : t('tasks.templates.newTemplate')));

/** The first problem as a sentence, or '' when the template can be saved. */
function problem(): string {
  if (!form.name.trim()) return t('tasks.templates.nameRequired');
  if (nameTaken(templates.list, form.name, tpl?.id)) return t('tasks.templates.nameTaken');
  if (form.estimate.trim()) {
    const n = Number(form.estimate);
    if (!Number.isInteger(n) || n < 5 || n > 720) return t('tasks.validation.estimateRange');
  }
  const lines = parseItems(form.items);
  if (lines.length > 200) return t('tasks.validation.tooManyItems');
  if (lines.some((l) => l.length > 200)) return t('tasks.validation.itemTooLong');
  return '';
}

async function save(): Promise<void> {
  error.value = problem();
  if (error.value || saving.value) return;
  saving.value = true;
  const input = {
    name: form.name.trim(),
    items: parseItems(form.items).map((title) => ({ title })),
    estimateMinutes: form.estimate.trim() ? Number(form.estimate) : null,
    // categories off: the picker is hidden, so the stored category is left alone
    categoryId: cats.on.value ? (form.categoryId === 'none' ? null : form.categoryId) : tpl?.categoryId ?? null,
  };
  try {
    if (tpl) await templates.update(tpl.id, input);
    else await templates.add(input);
    emit('close');
  } catch (e) {
    error.value = e instanceof ApiError ? e.userMessage : t('tasks.templates.saveFailed');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <AdaptiveSheet open :label="title" testid="template-dialog" :dismiss-on-scrim="!dirty" @close="emit('close')">
    <form class="form" novalidate @submit.prevent="save">
      <h2 class="h" data-testid="template-dialog-title">{{ title }}</h2>
      <p v-if="error" class="err" role="alert" data-testid="template-error">{{ error }}</p>
      <TextField v-model="form.name" :label="t('tasks.templates.name')" maxlength="80" autocomplete="off" data-testid="template-name" />
      <TextField v-model="form.items" :label="t('tasks.dialog.items')" multiline :rows="5" data-testid="template-items" />
      <TextField v-model="form.estimate" :label="t('tasks.dialog.estimate')" type="number" inputmode="numeric" min="5" max="720" step="5" data-testid="template-estimate" />
      <Select v-if="cats.on.value" v-model="form.categoryId" :label="t('tasks.dialog.category')" :options="catOptions" data-testid="template-category" />
      <div class="actions">
        <Button variant="text" data-testid="template-cancel" @click="emit('close')">{{ t('tasks.dialog.cancel') }}</Button>
        <Button type="submit" :disabled="saving" data-testid="template-save">{{ t('tasks.dialog.save') }}</Button>
      </div>
    </form>
  </AdaptiveSheet>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 12px; }
.h { margin: 4px 0 0; font: var(--md-sys-typescale-title-large); }
.err { margin: 0; padding: 8px 12px; border-radius: 12px; background: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container); font: var(--md-sys-typescale-body-medium); }
.actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
/* Left-handed mode (phone): the primary action is at the bottom left. */
html[data-hand='left'][data-touch] .actions { flex-direction: row-reverse; }
</style>
