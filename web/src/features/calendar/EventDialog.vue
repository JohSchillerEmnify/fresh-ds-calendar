<script setup lang="ts">
/**
 * Event dialog (kind 'event'): create ({ mode: 'create', date, time }) and edit ({ id }). Adaptive sheet.
 * Birthday mode (kind 'birthday', or an existing birthday in a calendar the person can write): the same sheet with a name,
 * a date and a colour only (feature birthdays); a birthday that is read-only opens as plain details.
 * Saves optimistically (the item shows at once, rolls back on failure) but stays open with the error until Google
 * confirmed (feature background-sync). Props `draft` / `error` restore a form after a failed attempt.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { api, ApiError } from '@/api/client';
import { googleColor, EVENT_COLOR_OPTIONS } from '@/api/colors';
import type { CalendarEvent, Reminders } from '@/api/types';
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';
import Button from '@/components/m3/Button.vue';
import ColorSwatchPicker from '@/components/m3/ColorSwatchPicker.vue';
import NewKindSwitch from '@/components/shell/NewKindSwitch.vue';
import ReminderEditor from '@/components/settings/ReminderEditor.vue';
import Select from '@/components/m3/Select.vue';
import TextField from '@/components/m3/TextField.vue';
import { enterNext } from '@/composables/useEnterNext';
import { isPhone } from '@/composables/useViewport';
import { pop } from '@/motion';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { useSyncStore } from '@/stores/sync';
import { usePendingDeletesStore } from '@/stores/pendingDeletes';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import { calendars, loadCalendars } from './calendars';
import EventMap from './EventMap.vue';
import LocationField from './LocationField.vue';
import { placeFromEvent } from './place';
import { createContext } from '@/extensions/create';
import { birthdayPatch, diffInput, formFromEvent, newForm, toBirthdayInput, toInput, validate, validateBirthday, withStart, type EventForm } from './eventForm';
import { formatDuration } from './timeline';
import { specialMarker } from '@/lib/items';
import { fromWallMinutes, wallMinutes } from './zone';
import { t, type MessageKey } from '@/i18n';

const props = defineProps<{ mode?: 'create'; birthday?: boolean; id?: string; date?: string; time?: string | null; minutes?: number; draft?: EventForm; error?: string }>();
const emit = defineEmits<{ close: [] }>();
const items = useItemsStore();
const settings = useSettingsStore();
const clock = useClockStore();
const ui = useUiStore();

const original = ref<CalendarEvent | null>(null);
const loading = ref(false);
const loadError = ref('');
const isEdit = computed(() => !!props.id);
const special = computed(() => original.value?.special ?? null);
/** An event the app does not change (a birthday of the contacts calendar, an invitation, other people's calendars) opens as plain details. */
const readOnly = computed(() => !!original.value?.readOnly);
/** The "Invitation from X" / "Calendar of X" line of the details; none for the contacts Birthdays calendar. */
const readOnlyReason = computed(() => {
  const r = original.value?.readOnlyReason;
  return r ? t(r.kind === 'invitation' ? 'calendar.event.readOnlyInvitation' : 'calendar.event.readOnlyCalendar', { by: r.by }) : '';
});
/** When the read-only event takes place, from the same form values the editable dialog would show. */
const whenText = computed(() => {
  const f = form.value;
  if (f.allDay) return f.endDate > f.startDate ? `${f.startDate} – ${f.endDate}` : f.startDate;
  return f.endDate === f.startDate ? `${f.startDate} ${f.startTime}–${f.endTime}` : `${f.startDate} ${f.startTime} – ${f.endDate} ${f.endTime}`;
});
/** The dialog edits a birthday: a new one, or an existing one in a writable calendar. */
const birthdayMode = computed(() => props.birthday === true || (!!original.value?.special && !original.value.readOnly));
/** Google keeps the date of this birthday (linked to a contact, or the person's own). */
const dateLocked = computed(() => !!original.value?.dateLocked);
/** Accessible name of the sheet. */
const label = computed(() => {
  const k = special.value;
  if (k) return t(k === 'anniversary' ? 'calendar.item.anniversary' : 'calendar.item.birthday');
  return birthdayMode.value ? t('calendar.birthday.newTitle') : isEdit.value ? t('calendar.event.editTitle') : t('calendar.event.newTitle');
});

function blank(): EventForm {
  const ctx = createContext(props.date, props.time);
  return newForm(ctx.date, ctx.time, 'primary', settings.settings.defaultEventColorId, props.minutes);
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
/** An opened event with a location shows it (and its map) right under the title, so the map needs no scrolling (owner, R6a). */
const locationUp = ref(false);
/** The read-only event's place, with its address read back from the location. */
const readOnlyPlace = computed(() => (original.value ? placeFromEvent(original.value) : null));

async function loadExisting() {
  if (!props.id) return;
  let ev = items.get(props.id) as CalendarEvent | undefined;
  if (!ev) {
    loading.value = true;
    try {
      ev = await api.getEvent(props.id);
      items.upsert(ev);
    } catch (e) {
      loadError.value = e instanceof ApiError ? e.userMessage : t('calendar.event.loadFailed');
    } finally {
      loading.value = false;
    }
  }
  if (ev && ev.kind === 'event') {
    original.value = ev;
    locationUp.value = !!ev.location;
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
  if (!l.some((o) => o.value === form.value.calendarId)) l.unshift({ value: form.value.calendarId, label: form.value.calendarId === 'primary' ? t('calendar.event.personal') : form.value.calendarId });
  return l;
});
const calColor = computed(() => calendars.value.find((c) => c.id === form.value.calendarId)?.color ?? original.value?.color ?? '#039be5');
const swatches = computed(() => [
  { value: '', name: t('calendar.event.fields.calendarColor'), color: calColor.value, testid: 'event-color-option' },
  ...EVENT_COLOR_OPTIONS.map((c) => ({ value: c.id, name: t(`calendar.event.colors.${c.name.toLowerCase()}` as MessageKey), color: c.hex, testid: 'event-color-option' })),
]);
/** The popup leads of the chosen calendar's default, shown while the event follows it. */
const calDefaults = computed(() => calendars.value.find((c) => c.id === form.value.calendarId)?.defaultReminders
  ?? (original.value?.reminders?.useDefault && original.value.calendarId === form.value.calendarId ? original.value.reminders.minutes : []));
const readOnlyDefaults = computed(() => calendars.value.find((c) => c.id === original.value?.calendarId)?.defaultReminders ?? []);
const accent = computed(() => googleColor(form.value.colorId)?.hex ?? calColor.value);
const duration = computed(() => {
  const f = form.value;
  if (validate({ ...f, title: 'x' })) return '';
  if (f.allDay) {
    const days = (wallMinutes(f.endDate, '00:00') - wallMinutes(f.startDate, '00:00')) / 1440 + 1;
    return days === 1 ? t('calendar.event.allDay') : t('calendar.event.days', { count: days }, days);
  }
  return formatDuration(wallMinutes(f.endDate, f.endTime) - wallMinutes(f.startDate, f.startTime));
});

// a picked place's map appears under the field: bring it above the sticky actions (the keyboard has closed by then)
watch(() => form.value.place, async (p, before) => {
  if (!p || p === before) return;
  await nextTick();
  sheet.value?.querySelector('.map-box')?.scrollIntoView({ block: 'nearest' });
});

watch(() => form.value.title, () => { if (error.value === t('calendar.event.validation.titleRequired')) error.value = ''; });

function buildEvent(id: string, input: ReturnType<typeof toInput>): CalendarEvent {
  const b = original.value;
  return {
    kind: 'event', id, calendarId: input.calendarId ?? 'primary', title: input.title, description: input.description ?? '', location: input.location ?? '', ...(input.place ? { place: input.place } : {}),
    allDay: input.allDay, start: input.start, end: input.end, colorId: input.colorId ?? null,
    color: googleColor(input.colorId)?.hex ?? calColor.value, etag: b?.etag ?? '', updated: b?.updated ?? '',
    reminders: input.reminders ? { useDefault: input.reminders.useDefault, minutes: input.reminders.useDefault ? calDefaults.value : input.reminders.minutes } : b?.reminders,
  };
}

/** The birthday as it is shown while its save is in flight (`base`: the opened one, null for a new one). */
function birthdayEvent(id: string, base: CalendarEvent | null): CalendarEvent {
  const f = form.value;
  return {
    kind: 'event', id, calendarId: base?.calendarId ?? f.calendarId, title: f.title.trim(), description: '', location: '', allDay: true, start: f.startDate,
    end: fromWallMinutes(wallMinutes(f.startDate, '00:00') + 1440).date, colorId: f.colorId || null, color: googleColor(f.colorId || null)?.hex ?? base?.color ?? calColor.value,
    special: base?.special ?? 'birthday', ...(base?.dateLocked ? { dateLocked: true as const } : {}), etag: base?.etag ?? '', updated: base?.updated ?? '', reminders: base?.reminders,
  };
}

function fail(e: unknown, what: string) {
  const msg = e instanceof ApiError ? e.userMessage : t('calendar.event.genericError');
  error.value = msg;
  ui.notify(t('calendar.event.rollback', { what }), { testid: 'event-rollback' });
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

/** A read-only event's reminders change at once (the dialog has no save button): the server asks Google, else keeps them itself. */
async function saveReadOnlyReminders(reminders: Reminders) {
  const ev = original.value;
  if (!ev || saving.value) return;
  error.value = '';
  saving.value = true;
  const shown = { useDefault: reminders.useDefault, minutes: reminders.useDefault ? readOnlyDefaults.value : reminders.minutes };
  try {
    const fresh = await items.optimisticItem(ev.id, { ...ev, reminders: shown }, () => api.updateEvent(ev.id, { reminders }));
    original.value = (fresh as CalendarEvent | undefined) ?? { ...ev, reminders: shown };
  } catch (e) {
    fail(e, `“${ev.title}”`);
  } finally {
    saving.value = false;
  }
}

/** Saves the birthday form: the whole yearly birthday changes (the server patches the series), then the views reload to show every year. */
async function saveBirthday() {
  if (saving.value) return;
  const bad = validateBirthday(form.value);
  if (bad) {
    error.value = bad.message;
    sheet.value?.querySelector<HTMLInputElement>(`[data-field="${bad.field}"]`)?.focus();
    return;
  }
  error.value = '';
  const title = form.value.title.trim();
  saving.value = true;
  try {
    if (original.value) {
      const ev = original.value;
      const patch = birthdayPatch(form.value, ev);
      if (Object.keys(patch).length === 0) { emit('close'); return; }
      await items.optimisticItem(ev.id, birthdayEvent(ev.id, ev), () => api.updateEvent(ev.id, patch, { ifMatch: items.get(ev.id)?.etag ?? ev.etag }));
      void useSyncStore().resyncAfterWrite(); // the other years of the series
    } else {
      const input = toBirthdayInput(form.value);
      const tmp = `tmp-${Date.now().toString(36)}`;
      await items.optimisticItem(tmp, birthdayEvent(tmp, null), () => api.createBirthday(input));
      void useSyncStore().resyncAfterWrite(); // a birthday repeats every year
    }
    emit('close');
  } catch (e) {
    fail(e, `“${title}”`);
  } finally {
    saving.value = false;
  }
}

/** No confirmation: the entry goes at once, the undo snackbar can bring it back (feature event-editing). */
function remove() {
  const ev = original.value;
  if (!ev || saving.value) return;
  usePendingDeletesStore().deleteEvent((items.get(ev.id) as CalendarEvent | undefined) ?? ev);
  emit('close');
}
</script>

<template>
  <AdaptiveSheet
    :open="true" :label="label"
    :testid="birthdayMode ? 'birthday-dialog' : 'event-dialog'" :dismiss-on-scrim="!dirty" @close="emit('close')"
  >
    <section v-if="original && readOnly" class="f" data-testid="event-readonly" :style="{ '--accent': original.color }">
      <header class="hd">
        <span class="dot" aria-hidden="true" />
        <h2 class="t" data-testid="event-readonly-title">{{ specialMarker(original) }} {{ original.title }}</h2>
      </header>
      <p class="lab" data-testid="event-readonly-date">{{ original.special ? `${t(`calendar.item.${original.special}`)} · ${original.start}` : whenText }}</p>
      <template v-if="original.location">
        <p class="lab" data-testid="event-readonly-location">
          <span class="on">{{ readOnlyPlace?.name ?? original.location }}</span><template v-if="readOnlyPlace?.address"><br><span data-testid="event-location-address">{{ readOnlyPlace.address }}</span></template>
        </p>
        <EventMap v-if="readOnlyPlace" :place="readOnlyPlace" :tile-url="clock.config.mapTileUrl" />
      </template>
      <p v-if="original.description" class="lab" data-testid="event-readonly-description">{{ original.description }}</p>
      <p v-if="readOnlyReason" class="lab" data-testid="event-readonly-reason">{{ readOnlyReason }}</p>
      <p v-else class="lab">{{ t('calendar.event.readOnly') }}</p>
      <div v-if="!original.special" class="colors" :inert="saving" :aria-busy="saving">
        <span class="lab">{{ t('calendar.reminders.title') }}</span>
        <ReminderEditor :model-value="original.reminders ?? { useDefault: true, minutes: [] }" prefix="event" allow-default :default-minutes="readOnlyDefaults" data-testid="event-reminders" @update:model-value="saveReadOnlyReminders" />
      </div>
      <p v-if="error" class="err" role="alert" data-testid="event-error">{{ error }}</p>
      <div class="actions">
        <span class="sp" />
        <Button variant="text" data-testid="event-cancel" @click="emit('close')">{{ t('calendar.actions.dismiss') }}</Button>
      </div>
    </section>
    <form v-else-if="birthdayMode" ref="sheet" class="f" novalidate :style="{ '--accent': accent }" @submit.prevent="saveBirthday" @keydown.enter="enterNext">
      <NewKindSwitch v-if="!isEdit" kind="birthday" :date="form.startDate" />
      <header class="hd rise" style="--i: 0">
        <span class="dot" aria-hidden="true" />
        <h2 class="t">{{ isEdit ? t('calendar.birthday.editTitle') : t('calendar.birthday.newTitle') }}</h2>
      </header>
      <p v-if="loadError" class="err" role="alert" data-testid="event-error">{{ loadError }}</p>
      <TextField v-model="form.title" class="rise" style="--i: 1" :label="t('calendar.birthday.name')" data-testid="birthday-name" data-field="title" autocomplete="off" enterkeyhint="next" />
      <TextField v-model="form.startDate" type="date" class="rise" style="--i: 2" :label="t('calendar.birthday.date')" :disabled="dateLocked" data-testid="birthday-date" data-field="startDate" data-enter-skip />
      <p v-if="dateLocked" class="lab" data-testid="birthday-date-locked">{{ t('calendar.birthday.dateLocked') }}</p>
      <div class="colors rise" style="--i: 3">
        <span class="lab">{{ t('calendar.event.fields.color') }}</span>
        <ColorSwatchPicker v-model="form.colorId" :swatches="swatches" :label="t('calendar.event.fields.color')" radio data-testid="event-color" />
      </div>
      <p v-if="error" class="err" role="alert" data-testid="event-error">{{ error }}</p>
      <div class="actions">
        <Button v-if="isEdit" variant="text" class="del" data-testid="event-delete" :disabled="saving || !original" @click="remove">{{ t('calendar.actions.delete') }}</Button>
        <span class="sp" />
        <Button variant="text" data-testid="event-cancel" @click="emit('close')">{{ t('calendar.actions.cancel') }}</Button>
        <Button type="submit" :disabled="saving || loading" data-testid="birthday-save">{{ saving ? t('calendar.event.saving') : t('calendar.actions.save') }}</Button>
      </div>
    </form>
    <form v-else ref="sheet" class="f" novalidate :style="{ '--accent': accent }" @submit.prevent="save" @keydown.enter="enterNext">
      <NewKindSwitch v-if="!isEdit" kind="event" :date="form.startDate" :time="switchTime" :minutes="props.minutes" />
      <header class="hd rise" style="--i: 0">
        <span class="dot" aria-hidden="true" />
        <h2 class="t">{{ isEdit ? t('calendar.event.editTitle') : t('calendar.event.newTitle') }}</h2>
        <span v-if="duration" class="dur" data-testid="event-duration">{{ duration }}</span>
      </header>
      <p v-if="loadError" class="err" role="alert" data-testid="event-error">{{ loadError }}</p>
      <TextField v-model="form.title" class="rise" style="--i: 1" :label="t('calendar.event.fields.title')" data-testid="event-title" data-field="title" autocomplete="off" enterkeyhint="next" />
      <template v-if="locationUp">
        <LocationField v-model="form.location" v-model:place="form.place" class="rise" style="--i: 2" :label="t('calendar.event.fields.location')" />
        <EventMap v-if="form.place" class="rise" style="--i: 2" :place="form.place" :tile-url="clock.config.mapTileUrl" />
      </template>
      <label class="check rise" style="--i: 2">
        <input v-model="form.allDay" type="checkbox" data-testid="event-all-day" data-field="allDay">
        <span>{{ t('calendar.event.fields.allDay') }}</span>
      </label>
      <div class="pair rise" style="--i: 3">
        <TextField v-model="startDate" type="date" :label="t('calendar.event.fields.startDate')" data-testid="event-start-date" data-field="startDate" data-enter-skip />
        <TextField v-if="!form.allDay" v-model="startTime" type="time" :label="t('calendar.event.fields.startTime')" data-testid="event-start-time" data-field="startTime" />
      </div>
      <div class="pair rise" style="--i: 4">
        <TextField v-model="form.endDate" type="date" :label="t('calendar.event.fields.endDate')" data-testid="event-end-date" data-field="endDate" data-enter-skip />
        <TextField v-if="!form.allDay" v-model="form.endTime" type="time" :label="t('calendar.event.fields.endTime')" data-testid="event-end-time" data-field="endTime" />
      </div>
      <Select v-model="form.calendarId" class="rise" style="--i: 5" :label="t('calendar.event.fields.calendar')" :options="calOptions" data-testid="event-calendar" />
      <div class="colors rise" style="--i: 6">
        <span class="lab">{{ t('calendar.event.fields.color') }}</span>
        <ColorSwatchPicker v-model="form.colorId" :swatches="swatches" :label="t('calendar.event.fields.color')" radio data-testid="event-color" />
      </div>
      <div class="colors rise" style="--i: 7">
        <span class="lab">{{ t('calendar.reminders.title') }}</span>
        <ReminderEditor v-model="form.reminders" prefix="event" allow-default :default-minutes="calDefaults" data-testid="event-reminders" />
      </div>
      <template v-if="!locationUp">
        <LocationField v-model="form.location" v-model:place="form.place" class="rise" style="--i: 7" :label="t('calendar.event.fields.location')" />
        <EventMap v-if="form.place" class="rise" style="--i: 7" :place="form.place" :tile-url="clock.config.mapTileUrl" />
      </template>
      <TextField v-model="form.description" class="rise" style="--i: 8" :label="t('calendar.event.fields.description')" data-testid="event-description" data-field="description" multiline :rows="3" />
      <p v-if="error" class="err" role="alert" data-testid="event-error">{{ error }}</p>
      <div class="actions">
        <Button v-if="isEdit" variant="text" class="del" data-testid="event-delete" :disabled="saving || !original" @click="remove">{{ t('calendar.actions.delete') }}</Button>
        <span class="sp" />
        <Button variant="text" data-testid="event-cancel" @click="emit('close')">{{ t('calendar.actions.cancel') }}</Button>
        <Button type="submit" :disabled="saving || loading" data-testid="event-save">{{ saving ? t('calendar.event.saving') : t('calendar.actions.save') }}</Button>
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
.lab .on { color: var(--md-sys-color-on-surface); }
.err { margin: 0; color: var(--md-sys-color-error); font: var(--md-sys-typescale-body-medium); }
.actions { display: flex; align-items: center; gap: 8px; position: sticky; bottom: -16px; margin: 4px -16px -16px; padding: 8px 16px 12px; background: var(--md-sys-color-surface-container-low); }
.sp { flex: 1; }
.del { color: var(--md-sys-color-error); }
:global(html[data-motion='full'] .rise) { animation: rise 300ms var(--md-sys-motion-emphasized) both; animation-delay: calc(var(--i) * 28ms); }
@keyframes rise { from { opacity: 0; transform: translateY(10px); } }
/* Left-handed mode (phone): the primary action is at the bottom left. */
html[data-hand='left'][data-touch] .actions { flex-direction: row-reverse; }
</style>
