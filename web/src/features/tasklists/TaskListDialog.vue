<script setup lang="ts">
import { ESTIMATE_MAX, ESTIMATE_MIN, TITLE_MAX } from '@calendar/shared/limits';
/**
 * Create / edit task list ('tasklist' dialog, props `{ mode: 'create', date (null = undated), time? }` or `{ mode: 'edit', id }`): one form, the same
 * fields in the same order. The modes differ only in the title, the Event / Task list switch, Delete / Leave and the question before a template replaces a list.
 */
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api, ApiError } from '@/api/client';
import type { Reminders, TaskList, TaskTemplate } from '@/api/types';
import { t, type MessageKey } from '@/i18n';
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';
import InkLine from './InkLine.vue';
import InkTools from './InkTools.vue';
import { useInkForm } from './useInkForm';
import { usePenDoubleTap } from './usePenDoubleTap';
import { useInkMode } from './useInkMode';
import { useInkStore } from '@/stores/ink';
import Button from '@/components/m3/Button.vue';
import IconButton from '@/components/m3/IconButton.vue';
import { IconClose } from '@/components/icons';
import NewKindSwitch from '@/components/shell/NewKindSwitch.vue';
import ConfirmDialog from '@/components/m3/ConfirmDialog.vue';
import ReminderEditor from '@/components/settings/ReminderEditor.vue';
import Select from '@/components/m3/Select.vue';
import Switch from '@/components/m3/Switch.vue';
import TextField from '@/components/m3/TextField.vue';
import { useDeviceStore } from '@/stores/device';
import { useItemsStore } from '@/stores/items';
import { useOutboxStore } from '@/stores/outbox';
import { usePendingDeletesStore } from '@/stores/pendingDeletes';
import { useAsyncSubmit } from '@/composables/useAsyncSubmit';
import { enterNext } from '@/composables/useEnterNext';
import { usePeople } from '@/composables/usePeople';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import { sameReminders } from '@/features/calendar/eventForm';
import { levelProp, parseIndented } from '@calendar/shared/subtasks';
import { linesOfItems, planItemEdits } from './itemEdits';
import { saveItemEdits } from './saveItemEdits';
import { newTaskListForm, validateForm, type TaskListForm } from './validate';
import { useTaskListsStore } from './store';
import { isMemberOnly, leaveList, shareList, unshareList, withNames } from './sharing';
import { useTaskCategories } from './categories';
import RepeatScopeDialog from './RepeatScopeDialog.vue';
import { useRepeatScope } from './repeatScope';
import TemplatePill from './TemplatePill.vue';
import { fillFromTemplate, inkLinesOf, templateFromForm, templateNameProblem } from './templates';
import { useTemplatesStore } from './templatesStore';

const props = defineProps<{ mode: 'create' | 'edit'; id?: string; date?: string | null; time?: string | null; minutes?: number; title?: string; draftList?: TaskList }>();
const emit = defineEmits<{ close: [] }>();
const items = useItemsStore();
// handwriting (feature handwritten-lists): ink lines for the items to add, in a wider ruled dialog where a pen is used
const inkMode = useInkMode();
const inkStore = useInkStore();
const inkForm = useInkForm();
const toolsShown = computed(() => inkMode.enabled.value);
const inking = computed(() => toolsShown.value && inkStore.mode === 'ink' && inkMode.ruled.value);
const wide = computed(() => inkMode.ruled.value);
usePenDoubleTap(inkForm.undo, () => inking.value);
const outbox = useOutboxStore();
const device = useDeviceStore();
const pendingDeletes = usePendingDeletesStore();
const settings = useSettingsStore();
const ui = useUiStore();
const lists = useTaskListsStore();

const editing = computed(() => props.mode === 'edit');
const loading = ref(false);
let etag = '';
let original = '';
let originalTitle = '';
/** A changed title of a repeating list asks "This task list / This and all following task lists" on save (feature tasklist-repeating). */
const scope = useRepeatScope();
let originalReminders: Reminders = { useDefault: true, minutes: [] };
const form = reactive<TaskListForm>({ ...newTaskListForm(props.date === undefined ? '' : props.date, props.time, props.minutes), title: (props.title ?? '').slice(0, TITLE_MAX) });
const error = ref('');
const saving = ref(false);
/** The list being edited, for the sharing controls (a shared list says who it is shared with). */
const current = computed(() => {
  const i = editing.value ? items.get(props.id!) : undefined;
  return i?.kind === 'tasklist' ? i : null;
});
/** The popup leads of the tasks calendar's default, shown while the list follows it. */
const taskDefaults = ref<number[]>([]);
const { people, refresh: refreshPeople } = usePeople();
const person = ref('');
const { busy: sharing, run: runSharing } = useAsyncSubmit({ onDone: () => emit('close'), error });
const memberOnly = computed(() => isMemberOnly(current.value));
const peopleOptions = computed(() => [
  { value: '', label: t('sharing.choose') }, ...people.value.map((p) => ({ value: p.sub, label: p.name })),
]);

function fill(src: TaskList) {
  etag = src.etag;
  Object.assign(form, {
    title: src.title, date: src.date ?? '', time: src.time ?? '', estimate: src.estimateMinutes ? String(src.estimateMinutes) : '',
    categoryId: src.categoryId ?? 'none', repeat: src.recurrence ?? '', items: linesOfItems(src.items),
    reminders: !src.reminders || src.reminders.useDefault ? { useDefault: true, minutes: [] } : { useDefault: false, minutes: [...src.reminders.minutes] },
  });
  if (src.reminders?.useDefault) taskDefaults.value = src.reminders.minutes;
  originalTitle = form.title;
  original = JSON.stringify(form);
  originalReminders = form.reminders ? { ...form.reminders } : { useDefault: true, minutes: [] };
}
onMounted(async () => {
  // the names already taken, for "Also save as template"
  templates.load().catch(() => undefined);
  device.read('tasksCalendarReminders', () => api.tasksCalendarReminders()).then((r) => { taskDefaults.value = r.defaultReminders; }).catch(() => undefined);
  if (!editing.value) {
    if (props.draftList) fill(props.draftList);
    // a carried title is unsaved input: the original stays untitled so closing asks first
    original = JSON.stringify(props.draftList ? form : { ...form, title: '' });
    return;
  }
  void refreshPeople();
  const cur = items.get(props.id!);
  if (cur?.kind === 'tasklist') { fill(cur); if (props.draftList) { const [o, ot, or] = [original, originalTitle, originalReminders]; fill(props.draftList); [etag, original, originalTitle, originalReminders] = [cur.etag, o, ot, or]; } return; }
  loading.value = true;
  try { const fresh = await api.getTaskList(props.id!); items.upsert(fresh); fill(fresh); }
  catch { ui.notify(t('tasks.list.gone')); emit('close'); }
  finally { loading.value = false; }
});

/** The item field shows all lines of an existing list (at most ten rows, then it scrolls). */
const itemRows = computed(() => Math.min(10, Math.max(4, form.items.split('\n').length + 1)));
const dirty = computed(() => JSON.stringify(form) !== original);
const cats = useTaskCategories();
const catOptions = computed(() => [{ value: 'none', label: t('tasks.noCategory') }, ...settings.categories.map((c) => ({ value: c.id, label: c.name }))]);
const cat = computed(() => settings.categoryById(form.categoryId === 'none' ? null : form.categoryId));
const repeatOptions = computed(() => [
  { value: '', label: t('tasks.dialog.repeatNone') }, { value: 'daily', label: t('tasks.dialog.daily') },
  { value: 'weekly', label: t('tasks.dialog.weekly') }, { value: 'monthly', label: t('tasks.dialog.monthly') },
]);

/** "Clear date": an empty Date field means no date, so the list will appear only in the Tasks view. */
function clearDate() {
  form.date = ''; form.time = ''; form.repeat = '';
}

// --- templates (feature tasklist-templates) ------------------------------------------------------------------------
const router = useRouter();
const templates = useTemplatesStore();
/** The template the form was filled from: the pill shows its name. */
const pickedTemplate = ref<string | null>(null);
/** "Also save as template": saving the new list also keeps it as a template named by its title. */
const alsoTemplate = ref(false);
const pill = ref<InstanceType<typeof TemplatePill> | null>(null);
/** A template picked on an existing list waits for the answer to "replace the list?". */
const replacing = ref<TaskTemplate | null>(null);
const onPick = (tpl: TaskTemplate) => { if (editing.value) replacing.value = tpl; else pickTemplate(tpl); };
function confirmReplace() {
  const tpl = replacing.value;
  replacing.value = null;
  if (tpl) pickTemplate(tpl);
}
function pickTemplate(tpl: TaskTemplate) {
  Object.assign(form, fillFromTemplate(form, tpl, (id) => !!settings.categoryById(id)));
  inkForm.set(inkLinesOf(tpl));
  pickedTemplate.value = tpl.name;
}
function manageTemplates() {
  emit('close');
  void router.push('/settings/templates');
}
/** The problem with "Also save as template", or '' (the list needs a title, and the name must be free). */
function templateProblem(): string {
  if (!alsoTemplate.value) return '';
  if (!form.title.trim()) return t('tasks.templates.titleRequired');
  return templateNameProblem(templates.list, form.title);
}

/** Only the fields the person changed: a change sent later must not undo another field changed elsewhere (ADR 0031). */
function changedFields<T extends Record<string, unknown>>(body: T, current: unknown): Partial<T> {
  const cur = (current ?? {}) as Record<string, unknown>;
  const same = (k: string) => k in cur && JSON.stringify(cur[k] ?? null) === JSON.stringify(body[k] ?? null);
  return Object.fromEntries(Object.entries(body).filter(([k]) => !same(k))) as Partial<T>;
}

async function save() {
  const found = editing.value ? items.get(props.id!) : undefined;
  const current = found?.kind === 'tasklist' ? found : undefined;
  const lines = parseIndented(form.items);
  // the handwritten items an existing list keeps are items too
  const kept = current ? current.items.filter((i) => i.ink).length : 0;
  error.value = validateForm(form, lines.length + kept + inkForm.written.value.length) ?? templateProblem();
  if (error.value || saving.value) return;
  const plan = current ? planItemEdits(current.items, lines) : null;
  saving.value = true;
  // Tags are shelved (feature task-list-categories): no `tags` key, so the server keeps the stored ones.
  const body = {
    title: form.title.trim(), date: form.date || null, time: form.date ? form.time || null : null,
    estimateMinutes: form.estimate.trim() ? Number(form.estimate) : null,
    // categories off: the picker is hidden, so the stored category is left alone
    ...(cats.on.value ? { categoryId: form.categoryId === 'none' ? null : form.categoryId } : {}),
    // the reminders are only sent when they changed (a create: when the list has its own)
    ...(form.reminders && !current?.shared && !sameReminders(form.reminders, originalReminders) ? { reminders: form.reminders } : {}),
    // a list that repeats keeps its rhythm: only one that does not repeat can be given one
    ...(current && !current.recurrence && form.date && form.repeat ? { recurrence: form.repeat } : {}),
  };
  const itemsChanged = !!plan && !!(plan.renames.length || plan.deletes.length || plan.adds.length || inkForm.written.value.length);
  // a renamed repeating list or changed item lines: the change may go to the following lists too, the rest of the form stays with this one
  const s = current && (body.title !== originalTitle.trim() || itemsChanged) ? await scope.ask(current) : 'this';
  if (!s) { saving.value = false; return; }
  try {
    if (editing.value && s === 'following') {
      const { title, ...rest } = body;
      // the item lines are sent separately, they are no change of the list's own fields
      const othersChanged = JSON.stringify({ ...form, title: '', items: '' }) !== JSON.stringify({ ...JSON.parse(original), title: '', items: '' });
      if (othersChanged) {
        outbox.updateList(props.id!, rest, undefined, etag);
        original = JSON.stringify({ ...form, title: (JSON.parse(original) as TaskListForm).title });
      }
      if (title !== originalTitle.trim()) outbox.updateList(props.id!, { title }, 'following');
    } else if (editing.value) {
      const changed = changedFields(body, current);
      if (Object.keys(changed).length || !itemsChanged) outbox.updateList(props.id!, changed, undefined, etag);
    } else {
      outbox.createList({
        ...body, items: [...lines.map(({ title, level }) => ({ title, ...levelProp(level) })), ...inkForm.written.value.map((strokes) => ({ title: '', strokes }))], recurrence: (form.date && form.repeat) || null,
      });
    }
    // the items follow the list's own change, in order, through the same outbox path as the expanded list's "+"
    if (current && plan) saveItemEdits(current, lines, plan, inkForm.written.value, s === 'following' ? s : undefined);
    // the list is saved; a template that fails now is only reported, the list stays
    if (alsoTemplate.value) {
      await templates.add(templateFromForm(form, cats.on.value, inkForm.written.value)).catch((e: unknown) => ui.notify(e instanceof ApiError ? e.userMessage : t('tasks.templates.saveFailed')));
    }
    void lists.refresh().catch(() => undefined);
    emit('close');
  } catch (e) {
    saving.value = false;
    error.value = e instanceof ApiError ? e.userMessage : t('tasks.dialog.failed');
  }
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
  <AdaptiveSheet open :wide="wide" :label="editing ? t('tasks.dialog.editTitle') : t('tasks.dialog.newTitle')" testid="tasklist-dialog" :dismiss-on-scrim="!dirty" :escape="!scope.asking.value && !pill?.open && !replacing" @close="emit('close')">
    <form class="form" novalidate @submit.prevent="save" @keydown.enter="enterNext">
      <NewKindSwitch v-if="!editing && props.date !== null" kind="tasklist" :date="form.date" :time="form.time || undefined" :minutes="props.minutes" :title="form.title" />
      <div class="headrow">
        <h2 class="h">{{ editing ? t('tasks.dialog.editTitle') : t('tasks.dialog.newTitle') }}</h2>
        <TemplatePill ref="pill" :picked="pickedTemplate" @pick="onPick" @manage="manageTemplates" />
      </div>
      <p v-if="error" class="err" role="alert" data-testid="tasklist-error">{{ error }}</p>
      <TextField v-model="form.title" :label="t('tasks.dialog.title')" data-testid="tasklist-title" data-field="title" :maxlength="TITLE_MAX" autocomplete="off" enterkeyhint="next" />
      <div class="two" :class="{ dated: !!form.date }">
        <div class="datecell">
          <TextField v-model="form.date" :label="t('tasks.dialog.date')" type="date" class="grow" data-testid="tasklist-date" data-field="date" />
          <IconButton v-if="form.date" :label="t('tasks.dialog.clearDate')" class="clear" data-testid="tasklist-date-clear" @click="clearDate"><IconClose /></IconButton>
        </div>
        <TextField v-model="form.time" :label="t('tasks.dialog.time')" type="time" data-testid="tasklist-time" data-field="time" />
      </div>
      <TextField v-model="form.estimate" :label="t('tasks.dialog.estimate')" type="number" inputmode="numeric" :min="ESTIMATE_MIN" :max="ESTIMATE_MAX" step="5" enterkeyhint="next" data-testid="tasklist-estimate" data-field="estimate" />
      <div v-if="cats.on.value" class="catrow">
        <span class="dot" :style="{ background: cat?.color ?? 'var(--md-sys-color-outline)' }" aria-hidden="true">{{ cat?.icon ?? '' }}</span>
        <Select v-model="form.categoryId" :label="t('tasks.dialog.category')" :options="catOptions" :disabled="memberOnly" :title="memberOnly ? t('sharing.ownerOnlyCategory') : undefined" class="grow" data-testid="tasklist-category" data-field="category" />
      </div>
      <div v-if="current && (current.shared || people.length)" class="share" data-testid="tasklist-sharing" data-field="share">
        <template v-if="current.shared">
          <p class="who">{{ memberOnly ? t('sharing.badgeMember', { name: current.shared.owner.name }) : t('sharing.sharedWith', { names: withNames(current.shared.with) || '–' }) }}</p>
          <Button v-if="!memberOnly" variant="tonal" :disabled="sharing" data-testid="tasklist-unshare" @click="unshare">{{ t('sharing.stop') }}</Button>
        </template>
        <template v-else>
          <Select v-model="person" :label="t('sharing.title')" :options="peopleOptions" class="grow" data-testid="tasklist-share-person" />
          <Button variant="tonal" :disabled="!person || sharing" data-testid="tasklist-share" @click="share">{{ t('sharing.share') }}</Button>
        </template>
      </div>
      <div v-if="form.reminders && !current?.shared" class="remrow" data-field="reminders">
        <span class="remlab">{{ t('calendar.reminders.title') }}</span>
        <ReminderEditor v-model="form.reminders" prefix="tasklist" allow-default :default-minutes="taskDefaults" data-testid="tasklist-reminders" />
      </div>
      <InkTools v-if="toolsShown" :tools="inking" :can-undo="inkForm.canUndo.value" @undo="inkForm.undo" />
      <div v-if="inking" class="inklines" :class="{ ruled: inkMode.ruled.value }" data-testid="tasklist-ink-lines" data-field="items">
        <InkLine v-for="(line, i) in inkForm.shown.value" :key="i" class="inkrow" :strokes="line" editable :label="t('ink.area')" @change="inkForm.change(i, $event)" />
      </div>
      <div v-else class="textlines" :class="{ ruled: inkMode.ruled.value || (toolsShown && inkStore.mode === 'text') }" data-testid="tasklist-text-lines" data-field="items">
        <TextField v-model="form.items" :label="t('tasks.dialog.items')" multiline :rows="itemRows" data-testid="tasklist-items" />
      </div>
      <Select v-if="form.date" v-model="form.repeat" :label="t('tasks.dialog.repeat')" :options="repeatOptions" :disabled="!!current?.recurrence" data-testid="tasklist-repeat" data-field="repeat" />
      <div class="tplrow">
        <span class="tpllab">{{ t('tasks.templates.alsoSave') }}</span>
        <Switch v-model="alsoTemplate" :label="t('tasks.templates.alsoSave')" data-testid="tasklist-save-as-template" />
      </div>
      <div class="actions">
        <Button v-if="memberOnly" variant="text" class="danger" data-testid="tasklist-leave" :disabled="sharing" @click="leave">{{ t('sharing.leave') }}</Button>
        <Button v-else-if="editing" variant="text" class="danger" data-testid="tasklist-delete" @click="remove">{{ t('tasks.dialog.delete') }}</Button>
        <span class="grow" />
        <Button variant="text" data-testid="tasklist-cancel" @click="emit('close')">{{ t('tasks.dialog.cancel') }}</Button>
        <Button type="submit" :disabled="saving || loading" data-testid="tasklist-save">{{ t('tasks.dialog.save') }}</Button>
      </div>
    </form>
    <!-- on the body: inside the anchored list popover a modal would be confined to (and cover) the list -->
    <Teleport to="body">
      <RepeatScopeDialog :open="scope.asking.value" @answer="scope.answer" />
      <ConfirmDialog :open="!!replacing" :title="t('tasks.templates.replaceTitle')" :message="t('tasks.templates.replaceHint')" :ok-label="t('tasks.templates.replaceOk')" @ok="confirmReplace" @cancel="replacing = null" />
    </Teleport>
  </AdaptiveSheet>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 12px; }
.inklines { --ink-h: 48px; display: flex; flex-direction: column; border-radius: 12px; background: var(--md-sys-color-surface-container-highest); padding: 0 12px; }
.inklines.ruled .inkrow { border-bottom: 1px solid var(--md-sys-color-outline-variant); }
.textlines.ruled :deep(textarea) { background: repeating-linear-gradient(transparent 0 31px, var(--md-sys-color-outline-variant) 31px 32px); line-height: 32px; }
.headrow { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.h { margin: 4px 0 0; font: var(--md-sys-typescale-title-large); min-width: 0; }
.tplrow { display: flex; align-items: center; gap: 12px; min-height: 44px; }
.tpllab { flex: 1; min-width: 0; font: var(--md-sys-typescale-body-large); }
.err { margin: 0; padding: 8px 12px; border-radius: 12px; background: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container); font: var(--md-sys-typescale-body-medium); }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.two > * { min-width: 0; }
.datecell { display: flex; align-items: center; }
/* with a date the × sits beside it: the date column takes a little more room so the full date stays readable on a phone */
.two.dated { grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); }
.datecell .clear { width: 32px; border-inline-width: 0; }
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
