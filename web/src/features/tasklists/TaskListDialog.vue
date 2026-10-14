<script setup lang="ts">
/** Create / edit task list ('tasklist' dialog, props `{ mode: 'create', date (null = undated), time? }` or `{ mode: 'edit', id }`). */
import { computed, onMounted, reactive, ref } from 'vue';
import { api, ApiError } from '@/api/client';
import type { TaskList } from '@/api/types';
import { t } from '@/i18n';
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';
import Button from '@/components/m3/Button.vue';
import NewKindSwitch from '@/components/shell/NewKindSwitch.vue';
import Select from '@/components/m3/Select.vue';
import TextField from '@/components/m3/TextField.vue';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { usePendingDeletesStore } from '@/stores/pendingDeletes';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import { newTaskListForm, parseItems, validateForm, type TaskListForm } from './validate';
import { useTaskListsStore } from './store';

const props = defineProps<{ mode: 'create' | 'edit'; id?: string; date?: string | null; time?: string | null }>();
const emit = defineEmits<{ close: [] }>();
const items = useItemsStore();
const pendingDeletes = usePendingDeletesStore();
const settings = useSettingsStore();
const ui = useUiStore();
const lists = useTaskListsStore();
const clock = useClockStore();

const editing = computed(() => props.mode === 'edit');
const loading = ref(false);
let etag = '';
let original = '';
const form = reactive<TaskListForm>(newTaskListForm(props.date === undefined ? '' : props.date, props.time));
const error = ref('');
const conflict = ref(false);
const saving = ref(false);

function fill(src: TaskList) {
  etag = src.etag;
  Object.assign(form, {
    title: src.title, date: src.date ?? '', noDate: src.date === null, time: src.time ?? '', estimate: src.estimateMinutes ? String(src.estimateMinutes) : '',
    categoryId: src.categoryId ?? 'none',
  });
  original = JSON.stringify(form);
}
onMounted(async () => {
  if (!editing.value) { original = JSON.stringify(form); return; }
  const cur = items.get(props.id!);
  if (cur?.kind === 'tasklist') return fill(cur);
  loading.value = true;
  try { const fresh = await api.getTaskList(props.id!); items.upsert(fresh); fill(fresh); }
  catch { ui.notify(t('tasks.list.gone')); emit('close'); }
  finally { loading.value = false; }
});

const dirty = computed(() => JSON.stringify(form) !== original);
const catOptions = computed(() => [{ value: 'none', label: t('tasks.noCategory') }, ...settings.categories.map((c) => ({ value: c.id, label: c.name }))]);
const cat = computed(() => settings.categoryById(form.categoryId === 'none' ? null : form.categoryId));
const repeatOptions = computed(() => [
  { value: '', label: t('tasks.dialog.repeatNone') }, { value: 'daily', label: t('tasks.dialog.daily') },
  { value: 'weekly', label: t('tasks.dialog.weekly') }, { value: 'monthly', label: t('tasks.dialog.monthly') },
]);

/** "No date" on: the list will appear only in the Tasks view. Off: back to a date (today when none is set). */
function toggleNoDate() {
  form.noDate = !form.noDate;
  if (form.noDate) { form.time = ''; form.repeat = ''; }
  else if (!form.date) form.date = clock.today;
}

async function save() {
  const current = editing.value ? items.get(props.id!) : undefined;
  error.value = (current?.kind === 'tasklist' ? validateForm(form, current.items.length) : validateForm(form)) ?? '';
  conflict.value = false;
  if (error.value || saving.value) return;
  saving.value = true;
  // Tags are shelved (ARCHITECTURE "Tags shelved"): no `tags` key, so the server keeps the stored ones.
  const body = {
    title: form.title.trim(), date: form.noDate ? null : form.date, time: form.noDate ? null : form.time || null,
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
      error.value = e.isConflict ? t('tasks.dialog.conflict') : e.userMessage;
      conflict.value = e.isConflict;
    } else error.value = t('tasks.dialog.failed');
  }
}
async function reload() {
  try { const fresh = await api.getTaskList(props.id!); items.upsert(fresh); fill(fresh); error.value = ''; conflict.value = false; }
  catch (e) { error.value = e instanceof ApiError ? e.userMessage : t('tasks.dialog.reloadFailed'); }
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
  <AdaptiveSheet open :label="editing ? t('tasks.dialog.editTitle') : t('tasks.dialog.newTitle')" testid="tasklist-dialog" :dismiss-on-scrim="!dirty" @close="emit('close')">
    <form class="form" novalidate @submit.prevent="save">
      <NewKindSwitch v-if="!editing && props.date !== null" kind="tasklist" :date="form.date" :time="form.time || undefined" />
      <h2 class="h">{{ editing ? t('tasks.dialog.editTitle') : t('tasks.dialog.newTitle') }}</h2>
      <p v-if="error" class="err" role="alert" data-testid="tasklist-error">{{ error }}</p>
      <div v-if="conflict" class="conflict"><Button variant="tonal" data-testid="tasklist-reload" @click="reload">{{ t('tasks.dialog.loadLatest') }}</Button></div>
      <TextField v-model="form.title" :label="t('tasks.dialog.title')" data-testid="tasklist-title" maxlength="200" autocomplete="off" />
      <div class="two">
        <TextField v-model="form.date" :label="t('tasks.dialog.date')" type="date" :disabled="form.noDate" data-testid="tasklist-date" />
        <TextField v-model="form.time" :label="t('tasks.dialog.time')" type="time" :disabled="form.noDate" data-testid="tasklist-time" />
      </div>
      <Button :variant="form.noDate ? 'tonal' : 'text'" class="nodate" :aria-pressed="form.noDate" data-testid="tasklist-no-date" @click="toggleNoDate">{{ t('tasks.dialog.noDate') }}</Button>
      <TextField v-model="form.estimate" :label="t('tasks.dialog.estimate')" type="number" inputmode="numeric" min="5" max="720" step="5" data-testid="tasklist-estimate" />
      <div class="catrow">
        <span class="dot" :style="{ background: cat?.color ?? 'var(--md-sys-color-outline)' }" aria-hidden="true">{{ cat?.icon ?? '' }}</span>
        <Select v-model="form.categoryId" :label="t('tasks.dialog.category')" :options="catOptions" class="grow" data-testid="tasklist-category" />
      </div>
      <TextField v-if="!editing" v-model="form.items" :label="t('tasks.dialog.items')" multiline :rows="4" data-testid="tasklist-items" />
      <Select v-if="!editing && !form.noDate" v-model="form.repeat" :label="t('tasks.dialog.repeat')" :options="repeatOptions" data-testid="tasklist-repeat" />
      <div class="actions">
        <Button v-if="editing" variant="text" class="danger" data-testid="tasklist-delete" @click="remove">{{ t('tasks.dialog.delete') }}</Button>
        <span class="grow" />
        <Button variant="text" data-testid="tasklist-cancel" @click="emit('close')">{{ t('tasks.dialog.cancel') }}</Button>
        <Button type="submit" :disabled="saving || loading" data-testid="tasklist-save">{{ t('tasks.dialog.save') }}</Button>
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
.nodate { align-self: flex-start; }
.catrow { display: flex; gap: 10px; align-items: center; }
.dot { flex: none; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; }
.grow { flex: 1; min-width: 0; }
.actions { display: flex; gap: 8px; align-items: center; margin-top: 4px; }
.danger { color: var(--md-sys-color-error); }
/* Left-handed mode (phone): the primary action is at the bottom left. */
html[data-hand='left'][data-touch] .actions { flex-direction: row-reverse; }
</style>
