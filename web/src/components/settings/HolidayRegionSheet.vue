<script setup lang="ts">
/** The picker of Settings › Calendars › Holidays (feature holiday-regions): search a country by its name, then add its holiday calendar (a connection is needed). */
import { computed, onMounted, ref } from 'vue';
import { ApiError } from '@/api/client';
import type { HolidayRegion, HolidayVariant } from '@calendar/shared/api';
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';
import Pressable from '@/components/m3/Pressable.vue';
import TextField from '@/components/m3/TextField.vue';
import { t } from '@/i18n';
import { language } from '@/i18n/language';
import { googleLang, matchRegions } from '@/lib/holidayRegions';
import { useHolidaysStore } from '@/stores/holidays';
import { useSyncStore } from '@/stores/sync';
import { useUiStore } from '@/stores/ui';

const emit = defineEmits<{ close: [] }>();
const holidays = useHolidaysStore();
const ui = useUiStore();
const regions = ref<HolidayRegion[] | null>(null);
const failed = ref(false);
const offline = typeof navigator !== 'undefined' && !navigator.onLine;
const query = ref('');
const chosen = ref<HolidayRegion | null>(null);
const busy = ref(false);
const shown = computed(() => matchRegions(regions.value ?? [], query.value, language.value));
const variantsLeft = computed(() => (chosen.value?.variants ?? []).filter((v) => !chosen.value!.added.includes(v)));

onMounted(async () => {
  if (offline) return;
  try {
    regions.value = await holidays.regions(googleLang(language.value));
  } catch {
    failed.value = true;
  }
});

/** Adds the calendar and closes; the events of the new calendar are read at once. */
async function add(r: HolidayRegion, variant: HolidayVariant) {
  busy.value = true;
  try {
    await holidays.add(r.code, variant, googleLang(language.value));
    void useSyncStore().resyncAfterWrite();
    emit('close');
  } catch (e) {
    ui.notify(e instanceof ApiError ? e.userMessage : t('settingsNav.holidays.addFailed'));
  } finally {
    busy.value = false;
  }
}

/** A region with one variant is added at once; one with both asks which days. */
function pick(r: HolidayRegion) {
  if (r.variants.length === 1) void add(r, r.variants[0]!);
  else chosen.value = r;
}
</script>

<template>
  <AdaptiveSheet :open="true" :label="t('settingsNav.holidays.add')" testid="holiday-region-sheet" @close="emit('close')">
    <div class="sheet">
      <h2 class="t">{{ chosen ? t('settingsNav.holidays.variantTitle') : t('settingsNav.holidays.add') }}</h2>
      <p v-if="offline" class="hint err" data-testid="holiday-offline">{{ t('settingsNav.holidays.needsConnection') }}</p>
      <p v-else-if="failed" class="hint err">{{ t('settingsNav.holidays.loadFailed') }}</p>
      <p v-else-if="!regions" class="hint">{{ t('settingsNav.holidays.loading') }}</p>
      <template v-else-if="chosen">
        <Pressable v-for="v in variantsLeft" :key="v" class="item" :disabled="busy" data-testid="holiday-variant" :data-variant="v" @click="add(chosen, v)">
          {{ t(`settingsNav.holidays.${v}`) }}
        </Pressable>
      </template>
      <template v-else>
        <TextField v-model="query" :label="t('settingsNav.holidays.searchLabel')" data-testid="holiday-region-search" />
        <p v-if="!shown.length" class="hint">{{ t('settingsNav.holidays.noMatch') }}</p>
        <div class="list">
          <Pressable v-for="r in shown" :key="r.code" class="item" :disabled="busy" data-testid="holiday-region" :data-region="r.name" @click="pick(r)">{{ r.name }}</Pressable>
        </div>
      </template>
    </div>
  </AdaptiveSheet>
</template>

<style scoped>
.sheet { display: flex; flex-direction: column; gap: 8px; padding: 8px 20px 20px; max-height: 80vh; }
.t { margin: 0; font: var(--md-sys-typescale-title-large); color: var(--md-sys-color-on-surface); }
.hint { margin: 0; font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
.hint.err { color: var(--md-sys-color-error); }
.list { display: flex; flex-direction: column; overflow-y: auto; min-height: 0; }
.item { display: flex; align-items: center; min-height: 48px; padding: 0 8px; text-align: left; font: var(--md-sys-typescale-body-large); color: var(--md-sys-color-on-surface); border-radius: var(--md-sys-shape-corner-medium); }
@media (hover: hover) { .item:hover { background: var(--md-sys-color-surface-container-high); } }
</style>
