<script setup lang="ts">
/**
 * Event dialog (kind 'event'): create ({ mode: 'create', date, time }) and edit ({ id }). Adaptive sheet.
 * Saves optimistically (the item shows at once, rolls back on failure) but stays open with the error until Google
 * confirmed (AC-32). Props `draft` / `error` restore a form after a failed attempt.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { api, ApiError } from '@/api/client';
import { googleColor, EVENT_COLOR_OPTIONS } from '@/api/colors';
import type { CalendarEvent } from '@/api/types';
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';
import Button from '@/components/m3/Button.vue';
import ColorSwatchPicker from '@/components/m3/ColorSwatchPicker.vue';
import NewKindSwitch from '@/components/shell/NewKindSwitch.vue';
import Select from '@/components/m3/Select.vue';
import TextField from '@/components/m3/TextField.vue';
import { isPhone } from '@/composables/useViewport';
import { pop } from '@/motion';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { usePendingDeletesStore } from '@/stores/pendingDeletes';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import { calendars, loadCalendars } from './calendars';
import { createContext } from '@/extensions/create';
import { diffInput, formFromEvent, newForm, toInput, validate, withStart, type EventForm } from './eventForm';
import { formatDuration } from './timeline';
import { wallMinutes } from './zone';

const props = defineProps<{ mode?: 'create'; id?: string; date?: string; time?: string | null; draft?: EventForm; error?: string }>();
const emit = defineEmits<{ close: [] }>();
const items = useItemsStore();
const settings = useSettingsStore();
const clock = useClockStore();
const ui = useUiStore();

const original = ref<CalendarEvent | null>(null);
const loading = ref(false);
const loadError = ref('');
const isEdit = computed(() => !!props.id);

function blank(): EventForm {
  const ctx = createContext(props.date, props.time);
  return newForm(ctx.date, ctx.time, 'primary', settings.settings.defaultEventColorId);
}
const form = ref<EventForm>(props.draft ? { ...props.draft } : blank());
const initial = ref<string>(JSON.stringify(form.value));
/** Time carried to the task list form on switching: a tapped slot's or one the person changed, never the default. */
const startShown = form.value.startTime;
const switchTime = computed(() => (form.value.allDay ? null : props.time != null || form.value.startTime !== startShown ? form.value.startTime : undefined));
const error = ref(props.error ?? '');
const saving = ref(false);
const sheet = ref<HTMLElement | null>(null);
const dirty = computed(() => JSON.stringify(form.value) !== initial.value);

async function loadExisting() {
  if (!props.id) return;
  let ev = items.get(props.id) as CalendarEvent | undefined;
  if (!ev) {
    loading.value = true;
    try {
      ev = await api.getEvent(props.id);
      items.upsert(ev);
    } catch (e) {
      loadError.value = e instanceof ApiError ? e.userMessage : 'Could not load the event';
    } finally {
      loading.value = false;
    }
  }
  if (ev && ev.kind === 'event') {
    original.value = ev;
    if (!props.draft) {
      form.value = formFromEvent(ev);
      initial.value = JSON.stringify(form.value);
    }
  }
}

onMounted(async () => {
  void loadCalendars().then(() => {
    // new events use the primary calendar
    if (!isEdit.value && !props.draft) {
      const primary = calendars.value.find((c) => c.primary) ?? calendars.value[0];
      if (primary && form.value.calendarId === 'primary') { form.value.calendarId = primary.id; initial.value = JSON.stringify(form.value); }
    }
  });
  await loadExisting();
  await nextTick();
  if (!isPhone.value && !isEdit.value) sheet.value?.querySelector<HTMLInputElement>('[data-testid="event-title"]')?.focus();
  const dot = sheet.value?.querySelector('.dot');
  if (dot) pop(dot, 0.4);
});

// --- fields -----------------------------------------------------------------------
const startDate = computed({ get: () => form.value.startDate, set: (v: string) => { form.value = withStart(form.value, v, form.value.startTime); } });
const startTime = computed({ get: () => form.value.startTime, set: (v: string) => { form.value = withStart(form.value, form.value.startDate, v); } });
const calOptions = computed(() => {
  const l = calendars.value.map((c) => ({ value: c.id, label: c.name }));
  if (!l.some((o) => o.value === form.value.calendarId)) l.unshift({ value: form.value.calendarId, label: form.value.calendarId === 'primary' ? 'Personal' : form.value.calendarId });
  return l;
});
const calColor = computed(() => calendars.value.find((c) => c.id === form.value.calendarId)?.color ?? original.value?.color ?? '#039be5');
const swatches = computed(() => [
  { value: '', name: 'Calendar color', color: calColor.value, testid: 'event-color-option' },
  ...EVENT_COLOR_OPTIONS.map((c) => ({ value: c.id, name: c.name, color: c.hex, testid: 'event-color-option' })),
]);
const accent = computed(() => googleColor(form.value.colorId)?.hex ?? calColor.value);
const duration = computed(() => {
  const f = form.value;
  if (validate({ ...f, title: 'x' })) return '';
  if (f.allDay) {
    const days = (wallMinutes(f.endDate, '00:00') - wallMinutes(f.startDate, '00:00')) / 1440 + 1;
    return days === 1 ? 'All day' : `${days} days`;
  }
  return formatDuration(wallMinutes(f.endDate, f.endTime) - wallMinutes(f.startDate, f.startTime));
});

watch(() => form.value.title, () => { if (error.value === 'Title is required') error.value = ''; });

function buildEvent(id: string, input: ReturnType<typeof toInput>): CalendarEvent {
  const b = original.value;
  return {
    kind: 'event', id, calendarId: input.calendarId ?? 'primary', title: input.title, description: input.description ?? '', location: input.location ?? '',
    allDay: input.allDay, start: input.start, end: input.end, colorId: input.colorId ?? null,
    color: googleColor(input.colorId)?.hex ?? calColor.value, etag: b?.etag ?? '', updated: b?.updated ?? '',
  };
}

function fail(e: unknown, what: string) {
  const msg = e instanceof ApiError ? e.userMessage : 'Something went wrong';
  error.value = msg;
  ui.notify(`${what} was not saved. It is back as it was.`, { testid: 'event-rollback' });
}

async function save() {
  if (saving.value) return;
  const bad = validate(form.value);
  if (bad) {
    error.value = bad.message;
    sheet.value?.querySelector<HTMLInputElement>(`[data-field="${bad.field}"]`)?.focus();
    return;
  }
  error.value = '';
  const input = toInput(form.value, clock.timeZone);
  saving.value = true;
  try {
    if (original.value) {
      const ev = original.value;
      const patch = diffInput(input, ev);
      if (Object.keys(patch).length === 0) { emit('close'); return; }
      await items.optimisticItem(ev.id, buildEvent(ev.id, input), () => api.updateEvent(ev.id, patch, { ifMatch: items.get(ev.id)?.etag ?? ev.etag }));
    } else {
      const tmp = `tmp-${Date.now().toString(36)}`;
      await items.optimisticItem(tmp, buildEvent(tmp, input), () => api.createEvent(input));
    }
    emit('close');
  } catch (e) {
    fail(e, `“${input.title}”`);
  } finally {
    saving.value = false;
  }
}

/** No confirmation: the entry goes at once, the undo snackbar can bring it back (ARCHITECTURE "Delete with undo"). */
function remove() {
  const ev = original.value;
  if (!ev || saving.value) return;
  usePendingDeletesStore().deleteEvent((items.get(ev.id) as CalendarEvent | undefined) ?? ev);
  emit('close');
}
</script>

<template>
  <AdaptiveSheet :open="true" :label="isEdit ? 'Edit event' : 'New event'" testid="event-dialog" :dismiss-on-scrim="!dirty" @close="emit('close')">
    <form ref="sheet" class="f" novalidate :style="{ '--accent': accent }" @submit.prevent="save">
      <NewKindSwitch v-if="!isEdit" kind="event" :date="form.startDate" :time="switchTime" />
      <header class="hd rise" style="--i: 0">
        <span class="dot" aria-hidden="true" />
        <h2 class="t">{{ isEdit ? 'Edit event' : 'New event' }}</h2>
        <span v-if="duration" class="dur" data-testid="event-duration">{{ duration }}</span>
      </header>
      <p v-if="loadError" class="err" role="alert" data-testid="event-error">{{ loadError }}</p>
      <TextField v-model="form.title" class="rise" style="--i: 1" label="Title" data-testid="event-title" data-field="title" autocomplete="off" enterkeyhint="done" />
      <label class="check rise" style="--i: 2">
        <input v-model="form.allDay" type="checkbox" data-testid="event-all-day" data-field="allDay">
        <span>All day</span>
      </label>
      <div class="pair rise" style="--i: 3">
        <TextField v-model="startDate" type="date" label="Start date" data-testid="event-start-date" data-field="startDate" />
        <TextField v-if="!form.allDay" v-model="startTime" type="time" label="Start time" data-testid="event-start-time" data-field="startTime" />
      </div>
      <div class="pair rise" style="--i: 4">
        <TextField v-model="form.endDate" type="date" label="End date" data-testid="event-end-date" data-field="endDate" />
        <TextField v-if="!form.allDay" v-model="form.endTime" type="time" label="End time" data-testid="event-end-time" data-field="endTime" />
      </div>
      <Select v-model="form.calendarId" class="rise" style="--i: 5" label="Calendar" :options="calOptions" data-testid="event-calendar" />
      <div class="colors rise" style="--i: 6">
        <span class="lab">Color</span>
        <ColorSwatchPicker v-model="form.colorId" :swatches="swatches" label="Color" radio data-testid="event-color" />
      </div>
      <TextField v-model="form.location" class="rise" style="--i: 7" label="Location" data-testid="event-location" data-field="location" autocomplete="off" />
      <TextField v-model="form.description" class="rise" style="--i: 8" label="Description" data-testid="event-description" data-field="description" multiline :rows="3" />
      <p v-if="error" class="err" role="alert" data-testid="event-error">{{ error }}</p>
      <div class="actions">
        <Button v-if="isEdit" variant="text" class="del" data-testid="event-delete" :disabled="saving || !original" @click="remove">Delete</Button>
        <span class="sp" />
        <Button variant="text" data-testid="event-cancel" @click="emit('close')">Cancel</Button>
        <Button type="submit" :disabled="saving || loading" data-testid="event-save">{{ saving ? 'Saving…' : 'Save' }}</Button>
      </div>
    </form>
  </AdaptiveSheet>
</template>

<style scoped>
.f { display: flex; flex-direction: column; gap: 12px; }
.hd { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
.dot { width: 14px; height: 14px; border-radius: 50%; background: var(--accent); flex: none; transition: background 200ms; }
.t { margin: 0; font: var(--md-sys-typescale-title-large); flex: 1; }
.dur { font: var(--md-sys-typescale-label-large); padding: 2px 10px; border-radius: 12px; background: color-mix(in srgb, var(--accent) 22%, var(--md-sys-color-surface-container-low)); font-variant-numeric: tabular-nums; }
.check { display: flex; align-items: center; gap: 12px; min-height: 44px; font: var(--md-sys-typescale-body-large); cursor: pointer; }
.check input { width: 22px; height: 22px; accent-color: var(--md-sys-color-primary); margin: 0 4px; }
.pair { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 8px; }
.pair > :only-child { grid-column: 1 / -1; }
.colors { display: flex; flex-direction: column; gap: 2px; }
.lab { font: var(--md-sys-typescale-label-medium); color: var(--md-sys-color-on-surface-variant); padding-left: 4px; }
.err { margin: 0; color: var(--md-sys-color-error); font: var(--md-sys-typescale-body-medium); }
.actions { display: flex; align-items: center; gap: 8px; position: sticky; bottom: -16px; margin: 4px -16px -16px; padding: 8px 16px 12px; background: var(--md-sys-color-surface-container-low); }
.sp { flex: 1; }
.del { color: var(--md-sys-color-error); }
:global(html[data-motion='full'] .rise) { animation: rise 300ms var(--md-sys-motion-emphasized) both; animation-delay: calc(var(--i) * 28ms); }
@keyframes rise { from { opacity: 0; transform: translateY(10px); } }
</style>
