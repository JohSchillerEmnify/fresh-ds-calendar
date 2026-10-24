<script setup lang="ts">
/**
 * "Save as template" (feature tasklist-templates): a small sheet with the template's name (prefilled with the list's
 * title), a preview of the items it keeps (never ticked) and Cancel / Save. The name is required and must be free.
 * Opened from a list's footer and from the Archive; teleported to the body like the repeat question, so the list's
 * own sheet stays open behind it.
 */
import { ref, watch } from 'vue';
import { ApiError } from '@/api/client';
import type { TaskList } from '@/api/types';
import { t } from '@/i18n';
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';
import Button from '@/components/m3/Button.vue';
import TextField from '@/components/m3/TextField.vue';
import { useUiStore } from '@/stores/ui';
import { useTaskCategories } from './categories';
import { nameTaken, templateFromList } from './templates';
import { useTemplatesStore } from './templatesStore';

const props = defineProps<{ open: boolean; list: TaskList | null }>();
const emit = defineEmits<{ close: [] }>();
const templates = useTemplatesStore();
const cats = useTaskCategories();
const ui = useUiStore();

const name = ref('');
const error = ref('');
const saving = ref(false);
// every opening starts from the list's title; the names already taken are read again (another device may have added one)
watch(() => props.open, (o) => {
  if (!o) return;
  name.value = props.list?.title ?? '';
  error.value = '';
  saving.value = false;
  templates.load().catch(() => undefined);
}, { immediate: true });

async function save(): Promise<void> {
  if (!props.list || saving.value) return;
  error.value = !name.value.trim() ? t('tasks.templates.nameRequired') : nameTaken(templates.list, name.value) ? t('tasks.templates.nameTaken') : '';
  if (error.value) return;
  saving.value = true;
  try {
    await templates.add(templateFromList(props.list, name.value, cats.on.value));
    ui.notify(t('tasks.templates.saved'));
    emit('close');
  } catch (e) {
    error.value = e instanceof ApiError ? e.userMessage : t('tasks.templates.saveFailed');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <AdaptiveSheet :open="open" :label="t('tasks.templates.save')" testid="template-save-dialog" @close="emit('close')">
    <form class="form" novalidate @submit.prevent="save">
      <h2 class="t">{{ t('tasks.templates.save') }}</h2>
      <p v-if="error" class="err" role="alert" data-testid="template-error">{{ error }}</p>
      <TextField v-model="name" :label="t('tasks.templates.name')" maxlength="80" autocomplete="off" enterkeyhint="done" data-testid="template-save-name" />
      <div class="preview">
        <span class="lab">{{ t('tasks.templates.preview') }}</span>
        <ul v-if="list?.items.length" class="items">
          <li v-for="i in list.items" :key="i.id" class="item" data-testid="template-save-item"><span class="box" aria-hidden="true" />{{ i.title }}</li>
        </ul>
        <p v-else class="none">{{ t('tasks.templates.noItems') }}</p>
      </div>
      <div class="actions">
        <Button variant="text" data-testid="template-save-cancel" @click="emit('close')">{{ t('tasks.dialog.cancel') }}</Button>
        <Button type="submit" :disabled="saving" data-testid="template-save-confirm">{{ t('tasks.dialog.save') }}</Button>
      </div>
    </form>
  </AdaptiveSheet>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 12px; }
.t { margin: 8px 0 0; font: var(--md-sys-typescale-title-large); }
.err { margin: 0; padding: 8px 12px; border-radius: 12px; background: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container); font: var(--md-sys-typescale-body-medium); }
.preview { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: var(--md-sys-shape-corner-medium); background: var(--md-sys-color-surface-container); }
.lab { font: var(--md-sys-typescale-label-medium); color: var(--md-sys-color-on-surface-variant); }
.items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; max-height: 30vh; overflow-y: auto; }
.item { display: flex; align-items: center; gap: 10px; min-height: 28px; font: var(--md-sys-typescale-body-medium); overflow-wrap: anywhere; }
.box { flex: none; width: 14px; height: 14px; border: 2px solid var(--md-sys-color-outline); border-radius: 3px; }
.none { margin: 0; font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
.actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
/* Left-handed mode (phone): the primary action is at the bottom left. */
html[data-hand='left'][data-touch] .actions { flex-direction: row-reverse; }
</style>
