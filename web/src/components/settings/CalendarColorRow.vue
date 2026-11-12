<script setup lang="ts">
/** The colour of one calendar, or of the tasks calendar (`tasks`) (feature calendar-colours): Google's palette, the current colour when it is none of them, a colour picker and a hex field. */
import { computed, onMounted, ref, watch } from 'vue';
import { GOOGLE_CALENDAR_COLORS, type CalendarColor } from '@calendar/shared/colors';
import { api, ApiError } from '@/api/client';
import { isHexColor } from '@/api/colors';
import ColorSwatchPicker from '@/components/m3/ColorSwatchPicker.vue';
import TextField from '@/components/m3/TextField.vue';
import { t } from '@/i18n';
import { useCalendarsStore } from '@/stores/calendars';
import { useDeviceStore } from '@/stores/device';
import { useUiStore } from '@/stores/ui';

const props = defineProps<{ calendarId?: string; tasks?: boolean }>();
const cals = useCalendarsStore();
const device = useDeviceStore();
const cal = computed(() => cals.list.find((c) => c.id === props.calendarId));
// the tasks calendar is no list entry: its colour is a device file, asked from the server until the device has it
const asked = ref('');
const tasksColor = computed(() => device.file<{ color: string }>('tasksCalendarColor')?.color ?? asked.value);
const current = computed(() => ((props.tasks ? tasksColor.value : cal.value?.color) ?? '').toLowerCase());

// the palette is a device file once synced; the built-in copy of Google's 24 shows until (or without) a fetch
const palette = ref<readonly CalendarColor[]>(GOOGLE_CALENDAR_COLORS);
onMounted(() => {
  device.read('calendarColors', () => api.calendarColors()).then((r) => { if (r.colors.length) palette.value = r.colors; }, () => undefined);
  if (props.tasks) device.read('tasksCalendarColor', () => api.tasksCalendarColor()).then((r) => { asked.value = r.color; }, () => undefined);
});

const swatches = computed(() => {
  const own = palette.value.map((c) => ({ value: c.background, name: t('settingsNav.labels.calendarColorN', { n: c.id }), color: c.background, testid: 'calendar-color-option' }));
  // a colour outside the palette (custom, or Google's default) is shown as selected too
  if (!current.value || own.some((s) => s.value === current.value)) return own;
  return [{ value: current.value, name: t('settingsNav.labels.calendarColorCurrent'), color: current.value, testid: 'calendar-color-option' }, ...own];
});

/** Recolours the calendar at once; a refused save puts the old colour back (the store rolls back) and says why. */
function save(hex: string, colorId?: string) {
  void (props.tasks ? saveTasks(hex, colorId) : cals.setColor(props.calendarId!, hex, colorId)).catch((e: unknown) => {
    useUiStore().notify(e instanceof ApiError ? e.userMessage : t('settings.saveFailed'));
  });
}
/** Like a calendar's: shown at once, put back when the server refuses. */
async function saveTasks(hex: string, colorId?: string): Promise<void> {
  const old = current.value;
  const put = (c: string) => { asked.value = c; device.putTasksColor(c); };
  put(hex);
  try {
    put((await api.setTasksCalendarColor(colorId ? { colorId } : { color: hex })).color);
  } catch (e) {
    if (old) put(old);
    throw e;
  }
}
function pick(hex: string) {
  if (hex !== current.value) save(hex, palette.value.find((c) => c.background === hex)?.id);
}

const hex = ref(current.value);
const hexError = ref('');
watch(current, (v) => { hex.value = v; hexError.value = ''; });
/** The typed colour is checked like the theme's seed colour. */
function commitHex() {
  const v = hex.value.trim().toLowerCase();
  if (!isHexColor(v)) { hexError.value = t('theme.fine.invalidColor'); return; }
  hexError.value = '';
  if (v !== current.value) save(v);
}
/** The native picker's final choice (`change`, not every drag step). */
function picked(e: Event) {
  const v = (e.target as HTMLInputElement).value.toLowerCase();
  if (v !== current.value) save(v);
}
</script>

<template>
  <div class="colors" data-testid="calendar-color-row">
    <div class="line">
      <ColorSwatchPicker :model-value="current || null" :swatches="swatches" :label="t('calendar.event.fields.color')" radio data-testid="calendar-color" @update:model-value="pick" />
      <label class="custom" :title="t('theme.fine.custom')">
        <input :key="current" type="color" :value="current || '#000000'" :aria-label="t('theme.fine.custom')" data-testid="calendar-color-custom" @change="picked" />
      </label>
    </div>
    <TextField v-model="hex" class="hex" :label="t('theme.fine.customHex')" data-testid="calendar-color-hex" :error="hexError" error-testid="calendar-color-error" autocomplete="off" autocapitalize="off" @commit="commitHex" />
  </div>
</template>

<style scoped>
.colors { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.line { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; }
.custom { position: relative; width: 36px; height: 36px; margin: 4px; border-radius: 50%; overflow: hidden; cursor: pointer; background: conic-gradient(red, yellow, lime, aqua, blue, magenta, red); box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.12); }
.custom input { opacity: 0; position: absolute; inset: 0; width: 100%; height: 100%; cursor: pointer; }
.hex { max-width: 200px; }
</style>
