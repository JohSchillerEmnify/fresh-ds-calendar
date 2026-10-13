<script setup lang="ts">
/** Create / edit task list ('tasklist' dialog, props `{ mode: 'create', date, time? }` or `{ mode: 'edit', id }`). */
import { computed, onMounted, reactive, ref } from 'vue';
import { api, ApiError } from '@/api/client';
import type { TaskList } from '@/api/types';
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';
import Button from '@/components/m3/Button.vue';
import NewKindSwitch from '@/components/shell/NewKindSwitch.vue';
import Select from '@/components/m3/Select.vue';
import TextField from '@/components/m3/TextField.vue';
import { useItemsStore } from '@/stores/items';
import { usePendingDeletesStore } from '@/stores/pendingDeletes';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import { newTaskListForm, parseItems, validateForm, type TaskListForm } from './validate';
import { useTaskListsStore } from './store';

const props = defineProps<{ mode: 'create' | 'edit'; id?: string; date?: string; time?: string | null }>();
const emit = defineEmits<{ close: [] }>();
const items = useItemsStore();
const pendingDeletes = usePendingDeletesStore();
const settings = useSettingsStore();
const ui = useUiStore();
const lists = useTaskListsStore();

const editing = computed(() => props.mode === 'edit');
const loading = ref(false);
let etag = '';
let original = '';
const form = reactive<TaskListForm>(newTaskListForm(props.date ?? '', props.time));
const error = ref('');
const conflict = ref(false);
const saving = ref(false);

function fill(t: TaskList) {
  etag = t.etag;
  Object.assign(form, {
    title: t.title, date: t.date, time: t.time ?? '', estimate: t.estimateMinutes ? String(t.estimateMinutes) : '',
    categoryId: t.categoryId ?? 'none',
  });
  original = JSON.stringify(form);
}
onMounted(async () => {
  if (!editing.value) { original = JSON.stringify(form); return; }
  const cur = items.get(props.id!);
  if (cur?.kind === 'tasklist') return fill(cur);
  loading.value = true;
  try { const t = await api.getTaskList(props.id!); items.upsert(t); fill(t); }
  catch { ui.notify('This task list no longer exists.'); emit('close'); }
  finally { loading.value = false; }
});

const dirty = computed(() => JSON.stringify(form) !== original);
const catOptions = computed(() => [{ value: 'none', label: 'No category' }, ...settings.categories.map((c) => ({ value: c.id, label: c.name }))]);
const cat = computed(() => settings.categoryById(form.categoryId === 'none' ? null : form.categoryId));
const repeatOptions = [{ value: '', label: 'Does not repeat' }, { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }];

async function save() {
  const current = editing.value ? items.get(props.id!) : undefined;
  error.value = (current?.kind === 'tasklist' ? validateForm(form, current.items.length) : validateForm(form)) ?? '';
  conflict.value = false;
  if (error.value || saving.value) return;
  saving.value = true;
  // Tags are shelved (ARCHITECTURE "Tags shelved"): no `tags` key, so the server keeps the stored ones.
  const body = {
    title: form.title.trim(), date: form.date, time: form.time || null,
    estimateMinutes: form.estimate.trim() ? Number(form.estimate) : null,
    categoryId: form.categoryId === 'none' ? null : form.categoryId,
  };
  try {
    if (editing.value) await items.updateTaskList(props.id!, body, etag);
    else {
      await items.createTaskList({
        ...body, items: parseItems(form.items).map((title) => ({ title })), recurrence: form.repeat || null,
      });
    }
    void lists.refresh().catch(() => undefined);
    emit('close');
  } catch (e) {
    saving.value = false;
    if (e instanceof ApiError) {
      error.value = e.userMessage.replace('This event was', 'This task list was');
      conflict.value = e.isConflict;
    } else error.value = 'Something went wrong. Try again.';
  }
}
async function reload() {
  try { const t = await api.getTaskList(props.id!); items.upsert(t); fill(t); error.value = ''; conflict.value = false; }
  catch (e) { error.value = e instanceof ApiError ? e.userMessage : 'Could not reload.'; }
}
/** No confirmation: the list goes at once, the undo snackbar can bring it back (ARCHITECTURE "Delete with undo"). */
function remove() {
  const tl = items.get(props.id!);
  if (tl?.kind !== 'tasklist') return;
  pendingDeletes.deleteTaskList({ ...tl, etag: etag || tl.etag });
  emit('close');
}
</script>

<template>
  <AdaptiveSheet open :label="editing ? 'Edit task list' : 'New task list'" testid="tasklist-dialog" :dismiss-on-scrim="!dirty" @close="emit('close')">
    <form class="form" novalidate @submit.prevent="save">
      <NewKindSwitch v-if="!editing" kind="tasklist" :date="form.date" :time="form.time || undefined" />
      <h2 class="h">{{ editing ? 'Edit task list' : 'New task list' }}</h2>
      <p v-if="error" class="err" role="alert" data-testid="tasklist-error">{{ error }}</p>
      <div v-if="conflict" class="conflict"><Button variant="tonal" data-testid="tasklist-reload" @click="reload">Load latest version</Button></div>
      <TextField v-model="form.title" label="Title" data-testid="tasklist-title" maxlength="200" autocomplete="off" />
      <div class="two">
        <TextField v-model="form.date" label="Date" type="date" data-testid="tasklist-date" />
        <TextField v-model="form.time" label="Time (optional)" type="time" data-testid="tasklist-time" />
      </div>
      <TextField v-model="form.estimate" label="Estimate in minutes (optional)" type="number" inputmode="numeric" min="5" max="720" step="5" data-testid="tasklist-estimate" />
      <div class="catrow">
        <span class="dot" :style="{ background: cat?.color ?? 'var(--md-sys-color-outline)' }" aria-hidden="true">{{ cat?.icon ?? '' }}</span>
        <Select v-model="form.categoryId" label="Category" :options="catOptions" class="grow" data-testid="tasklist-category" />
      </div>
      <TextField v-if="!editing" v-model="form.items" label="Items (one per line)" multiline :rows="4" data-testid="tasklist-items" />
      <Select v-if="!editing" v-model="form.repeat" label="Repeat" :options="repeatOptions" data-testid="tasklist-repeat" />
      <div class="actions">
        <Button v-if="editing" variant="text" class="danger" data-testid="tasklist-delete" @click="remove">Delete</Button>
        <span class="grow" />
        <Button variant="text" data-testid="tasklist-cancel" @click="emit('close')">Cancel</Button>
        <Button type="submit" :disabled="saving || loading" data-testid="tasklist-save">Save</Button>
      </div>
    </form>
  </AdaptiveSheet>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 12px; }
.h { margin: 4px 0 0; font: var(--md-sys-typescale-title-large); }
.err { margin: 0; padding: 8px 12px; border-radius: 12px; background: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container); font: var(--md-sys-typescale-body-medium); }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.two > * { min-width: 0; }
.catrow { display: flex; gap: 10px; align-items: center; }
.dot { flex: none; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; }
.grow { flex: 1; min-width: 0; }
.actions { display: flex; gap: 8px; align-items: center; margin-top: 4px; }
.danger { color: var(--md-sys-color-error); }
/* Left-handed mode (phone): the primary action is at the bottom left. */
@media (max-width: 767.98px) { html[data-hand='left'] .actions { flex-direction: row-reverse; } }
</style>
