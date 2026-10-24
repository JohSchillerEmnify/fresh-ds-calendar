<script setup lang="ts">
/** Create / edit task list ('tasklist' dialog, props `{ mode: 'create', date (null = undated), time? }` or `{ mode: 'edit', id }`). */
import { computed, onMounted, reactive, ref } from 'vue';
import { api, ApiError } from '@/api/client';
import type { Person, Reminders, TaskList } from '@/api/types';
import { t, type MessageKey } from '@/i18n';
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';
import Button from '@/components/m3/Button.vue';
import NewKindSwitch from '@/components/shell/NewKindSwitch.vue';
import ReminderEditor from '@/components/settings/ReminderEditor.vue';
import Select from '@/components/m3/Select.vue';
import TextField from '@/components/m3/TextField.vue';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { usePendingDeletesStore } from '@/stores/pendingDeletes';
import { useAsyncSubmit } from '@/composables/useAsyncSubmit';
import { enterNext } from '@/composables/useEnterNext';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import { sameReminders } from '@/features/calendar/eventForm';
import { newTaskListForm, parseItems, validateForm, type TaskListForm } from './validate';
import { useTaskListsStore } from './store';
import { isMemberOnly, leaveList, shareList, unshareList, withNames } from './sharing';
import { useTaskCategories } from './categories';
import RepeatScopeDialog from './RepeatScopeDialog.vue';
import { useRepeatScope } from './repeatScope';
import { usePluginEnabled } from '@/plugins';
import DoorSwitch from '@/plugins/door/DoorSwitch.vue';
import { DOOR_PLUGIN, hasDoor, withDoor } from '@/plugins/door/door';

const props = defineProps<{ mode: 'create' | 'edit'; id?: string; date?: string | null; time?: string | null }>();
const emit = defineEmits<{ close: [] }>();
const items = useItemsStore();
const pendingDeletes = usePendingDeletesStore();
const settings = useSettingsStore();
const ui = useUiStore();
const lists = useTaskListsStore();
const clock = useClockStore();
/** Door plugin (ADR 0004): the "Show on door" switch exists only where the deployment turned the plugin on. */
const doorOn = usePluginEnabled(DOOR_PLUGIN);
const door = ref(false);

const editing = computed(() => props.mode === 'edit');
const loading = ref(false);
let etag = '';
let original = '';
let originalTitle = '';
let originalDoor = false;
/** A changed title of a repeating list asks "This task list / This and all following task lists" on save (feature tasklist-repeating). */
const scope = useRepeatScope();
let originalReminders: Reminders = { useDefault: true, minutes: [] };
const form = reactive<TaskListForm>(newTaskListForm(props.date === undefined ? '' : props.date, props.time));
const error = ref('');
const conflict = ref(false);
const saving = ref(false);
/** The list being edited, for the sharing controls (a shared list says who it is shared with). */
const current = computed(() => {
  const i = editing.value ? items.get(props.id!) : undefined;
  return i?.kind === 'tasklist' ? i : null;
});
/** The popup leads of the tasks calendar's default, shown while the list follows it. */
const taskDefaults = ref<number[]>([]);
const people = ref<Person[]>([]);
const person = ref('');
const { busy: sharing, run: runSharing } = useAsyncSubmit({ onDone: () => emit('close'), error });
const memberOnly = computed(() => isMemberOnly(current.value));
const peopleOptions = computed(() => [
  { value: '', label: t('sharing.choose') }, ...people.value.map((p) => ({ value: p.sub, label: p.name })),
]);

function fill(src: TaskList) {
  etag = src.etag;
  Object.assign(form, {
    title: src.title, date: src.date ?? '', noDate: src.date === null, time: src.time ?? '', estimate: src.estimateMinutes ? String(src.estimateMinutes) : '',
    categoryId: src.categoryId ?? 'none',
    reminders: !src.reminders || src.reminders.useDefault ? { useDefault: true, minutes: [] } : { useDefault: false, minutes: [...src.reminders.minutes] },
  });
  if (src.reminders?.useDefault) taskDefaults.value = src.reminders.minutes;
  door.value = hasDoor(src.tags);
  originalDoor = door.value;
  originalTitle = form.title;
  original = JSON.stringify(form);
  originalReminders = form.reminders ? { ...form.reminders } : { useDefault: true, minutes: [] };
}
onMounted(async () => {
  api.tasksCalendarReminders().then((r) => { taskDefaults.value = r.defaultReminders; }).catch(() => undefined);
  if (!editing.value) { original = JSON.stringify(form); return; }
  api.people().then((r) => { people.value = r.people; }).catch(() => undefined);
  const cur = items.get(props.id!);
  if (cur?.kind === 'tasklist') return fill(cur);
  loading.value = true;
  try { const fresh = await api.getTaskList(props.id!); items.upsert(fresh); fill(fresh); }
  catch { ui.notify(t('tasks.list.gone')); emit('close'); }
  finally { loading.value = false; }
});

const dirty = computed(() => JSON.stringify(form) !== original);
const cats = useTaskCategories();
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
  // Tags are shelved (feature task-list-categories): no `tags` key, so the server keeps the stored ones — except with the door
  // plugin on, where the whole array goes with the door tag set or cleared (the other tags stay).
  const body = {
    title: form.title.trim(), date: form.noDate ? null : form.date, time: form.noDate ? null : form.time || null,
    estimateMinutes: form.estimate.trim() ? Number(form.estimate) : null,
    ...(doorOn.value ? { tags: withDoor(current?.kind === 'tasklist' ? current.tags : [], door.value) } : {}),
    // categories off: the picker is hidden, so the stored category is left alone
    ...(cats.on.value ? { categoryId: form.categoryId === 'none' ? null : form.categoryId } : {}),
    // the reminders are only sent when they changed (a create: when the list has its own)
    ...(form.reminders && !(current?.kind === 'tasklist' && current.shared) && !sameReminders(form.reminders, originalReminders) ? { reminders: form.reminders } : {}),
  };
  // a renamed repeating list: the title may go to the following lists too, the rest of the form stays with this one
  const s = editing.value && current?.kind === 'tasklist' && body.title !== originalTitle.trim() ? await scope.ask(current) : 'this';
  if (!s) { saving.value = false; return; }
  try {
    if (editing.value && s === 'following') {
      const { title, ...rest } = body;
      const othersChanged = JSON.stringify({ ...form, title: '' }) !== JSON.stringify({ ...JSON.parse(original), title: '' }) || door.value !== originalDoor;
      if (othersChanged) {
        const saved = await items.updateTaskList(props.id!, rest, etag);
        // saved: a retry after a failed title request sends only the title (with the new version)
        etag = saved.etag;
        original = JSON.stringify({ ...form, title: (JSON.parse(original) as TaskListForm).title });
        originalDoor = door.value;
      }
      await items.updateTaskList(props.id!, { title }, undefined, 'following');
    } else if (editing.value) await items.updateTaskList(props.id!, body, etag);
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
/** Runs a sharing call; on failure the dialog stays open with the server's message. */
function sharingAction(fn: () => Promise<void>, failed: MessageKey) {
  if (sharing.value) return;
  return runSharing(fn, failed);
}
const share = () => sharingAction(() => shareList(props.id!, person.value), 'sharing.shareFailed');
const unshare = () => sharingAction(() => unshareList(props.id!), 'sharing.stopFailed');
const leave = () => sharingAction(() => leaveList(props.id!), 'sharing.leaveFailed');
/** No confirmation: the list goes at once, the undo snackbar can bring it back (feature tasklist-editing). */
function remove() {
  const tl = items.get(props.id!);
  if (tl?.kind !== 'tasklist') return;
  pendingDeletes.deleteTaskList({ ...tl, etag: etag || tl.etag });
  emit('close');
}
</script>

<template>
  <AdaptiveSheet open :label="editing ? t('tasks.dialog.editTitle') : t('tasks.dialog.newTitle')" testid="tasklist-dialog" :dismiss-on-scrim="!dirty" :escape="!scope.asking.value" @close="emit('close')">
    <form class="form" novalidate @submit.prevent="save" @keydown.enter="enterNext">
      <NewKindSwitch v-if="!editing && props.date !== null" kind="tasklist" :date="form.date" :time="form.time || undefined" />
      <h2 class="h">{{ editing ? t('tasks.dialog.editTitle') : t('tasks.dialog.newTitle') }}</h2>
      <p v-if="error" class="err" role="alert" data-testid="tasklist-error">{{ error }}</p>
      <div v-if="conflict" class="conflict"><Button variant="tonal" data-testid="tasklist-reload" @click="reload">{{ t('tasks.dialog.loadLatest') }}</Button></div>
      <TextField v-model="form.title" :label="t('tasks.dialog.title')" data-testid="tasklist-title" maxlength="200" autocomplete="off" enterkeyhint="next" />
      <div class="two">
        <TextField v-model="form.date" :label="t('tasks.dialog.date')" type="date" :disabled="form.noDate" data-testid="tasklist-date" />
        <TextField v-model="form.time" :label="t('tasks.dialog.time')" type="time" :disabled="form.noDate" data-testid="tasklist-time" />
      </div>
      <Button :variant="form.noDate ? 'tonal' : 'text'" class="nodate" :aria-pressed="form.noDate" data-testid="tasklist-no-date" @click="toggleNoDate">{{ t('tasks.dialog.noDate') }}</Button>
      <TextField v-model="form.estimate" :label="t('tasks.dialog.estimate')" type="number" inputmode="numeric" min="5" max="720" step="5" :enterkeyhint="editing ? 'done' : 'next'" data-testid="tasklist-estimate" />
      <DoorSwitch v-if="doorOn" v-model="door" />
      <div v-if="cats.on.value" class="catrow">
        <span class="dot" :style="{ background: cat?.color ?? 'var(--md-sys-color-outline)' }" aria-hidden="true">{{ cat?.icon ?? '' }}</span>
        <Select v-model="form.categoryId" :label="t('tasks.dialog.category')" :options="catOptions" :disabled="memberOnly" :title="memberOnly ? t('sharing.ownerOnlyCategory') : undefined" class="grow" data-testid="tasklist-category" />
      </div>
      <div v-if="current && (current.shared || people.length)" class="share" data-testid="tasklist-sharing">
        <template v-if="current.shared">
          <p class="who">{{ memberOnly ? t('sharing.badgeMember', { name: current.shared.owner.name }) : t('sharing.sharedWith', { names: withNames(current.shared.with) || '–' }) }}</p>
          <Button v-if="!memberOnly" variant="tonal" :disabled="sharing" data-testid="tasklist-unshare" @click="unshare">{{ t('sharing.stop') }}</Button>
        </template>
        <template v-else>
          <Select v-model="person" :label="t('sharing.title')" :options="peopleOptions" class="grow" data-testid="tasklist-share-person" />
          <Button variant="tonal" :disabled="!person || sharing" data-testid="tasklist-share" @click="share">{{ t('sharing.share') }}</Button>
        </template>
      </div>
      <div v-if="form.reminders && !current?.shared" class="remrow">
        <span class="remlab">{{ t('calendar.reminders.title') }}</span>
        <ReminderEditor v-model="form.reminders" prefix="tasklist" allow-default :default-minutes="taskDefaults" data-testid="tasklist-reminders" />
      </div>
      <TextField v-if="!editing" v-model="form.items" :label="t('tasks.dialog.items')" multiline :rows="4" data-testid="tasklist-items" />
      <Select v-if="!editing && !form.noDate" v-model="form.repeat" :label="t('tasks.dialog.repeat')" :options="repeatOptions" data-testid="tasklist-repeat" />
      <div class="actions">
        <Button v-if="memberOnly" variant="text" class="danger" data-testid="tasklist-leave" :disabled="sharing" @click="leave">{{ t('sharing.leave') }}</Button>
        <Button v-else-if="editing" variant="text" class="danger" data-testid="tasklist-delete" @click="remove">{{ t('tasks.dialog.delete') }}</Button>
        <span class="grow" />
        <Button variant="text" data-testid="tasklist-cancel" @click="emit('close')">{{ t('tasks.dialog.cancel') }}</Button>
        <Button type="submit" :disabled="saving || loading" data-testid="tasklist-save">{{ t('tasks.dialog.save') }}</Button>
      </div>
    </form>
    <!-- on the body: inside the anchored list popover a modal would be confined to (and cover) the list -->
    <Teleport to="body"><RepeatScopeDialog :open="scope.asking.value" @answer="scope.answer" /></Teleport>
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
.remrow { display: flex; flex-direction: column; gap: 2px; }
.remlab { padding-left: 4px; font: var(--md-sys-typescale-label-medium); color: var(--md-sys-color-on-surface-variant); }
.share { display: flex; gap: 10px; align-items: center; }
.who { flex: 1; margin: 0; font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
.actions { display: flex; gap: 8px; align-items: center; margin-top: 4px; }
.danger { color: var(--md-sys-color-error); }
/* Left-handed mode (phone): the primary action is at the bottom left. */
html[data-hand='left'][data-touch] .actions { flex-direction: row-reverse; }
</style>
