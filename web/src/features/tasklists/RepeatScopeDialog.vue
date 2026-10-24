<script setup lang="ts">
/**
 * "Change repeating list": This week / All weeks (radio list, This week preselected), Cancel / OK — Google's question for
 * a repeating event (feature tasklist-repeating). Built like `ConfirmDialog`. Daily lists say day, monthly lists month.
 */
import { ref, watch } from 'vue';
import type { ChangeScope, Recurrence } from '@/api/types';
import { t, type MessageKey } from '@/i18n';
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';
import Button from '@/components/m3/Button.vue';

/** `recurrence`: the rule of the list being asked about; null = closed. */
const props = defineProps<{ recurrence: Recurrence | null }>();
const emit = defineEmits<{ answer: [scope: ChangeScope | null] }>();

const LABELS: Record<Recurrence, [MessageKey, MessageKey]> = {
  daily: ['tasks.repeatScope.thisDay', 'tasks.repeatScope.allDays'],
  weekly: ['tasks.repeatScope.thisWeek', 'tasks.repeatScope.allWeeks'],
  monthly: ['tasks.repeatScope.thisMonth', 'tasks.repeatScope.allMonths'],
};
const choice = ref<ChangeScope>('this');
// every question starts on "This week", as Google's starts on "This event"
watch(() => props.recurrence, (r) => { if (r) choice.value = 'this'; });
const options = (r: Recurrence): { value: ChangeScope; label: string }[] => [
  { value: 'this', label: t(LABELS[r][0]) }, { value: 'all', label: t(LABELS[r][1]) },
];
</script>

<template>
  <AdaptiveSheet :open="!!recurrence" :label="t('tasks.repeatScope.title')" testid="repeat-scope-dialog" @close="emit('answer', null)">
    <h2 class="t">{{ t('tasks.repeatScope.title') }}</h2>
    <div v-if="recurrence" class="opts" role="radiogroup" :aria-label="t('tasks.repeatScope.title')">
      <label v-for="o in options(recurrence)" :key="o.value" class="opt" :data-testid="`repeat-scope-${o.value}`" :data-checked="choice === o.value ? 'true' : undefined">
        <input v-model="choice" type="radio" name="repeat-scope" :value="o.value" />
        <span>{{ o.label }}</span>
      </label>
    </div>
    <div class="actions">
      <Button variant="text" data-testid="repeat-scope-cancel" @click="emit('answer', null)">{{ t('tasks.dialog.cancel') }}</Button>
      <Button data-testid="repeat-scope-ok" @click="emit('answer', choice)">{{ t('tasks.repeatScope.ok') }}</Button>
    </div>
  </AdaptiveSheet>
</template>

<style scoped>
.t { margin: 8px 0 0; font: var(--md-sys-typescale-title-large); }
.opts { display: flex; flex-direction: column; margin-top: 12px; }
.opt { display: flex; align-items: center; gap: 16px; min-height: 48px; padding: 0 4px; border-radius: 12px; cursor: pointer; font: var(--md-sys-typescale-body-large); }
.opt input { width: 20px; height: 20px; margin: 0; accent-color: var(--md-sys-color-primary); }
.actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
/* Left-handed mode (phone): the primary action is at the bottom left. */
html[data-hand='left'][data-touch] .actions { flex-direction: row-reverse; }
</style>
