<script setup lang="ts">
/**
 * "Change repeating list": This task list / This and all following task lists (radio list, the first preselected),
 * Cancel / OK — Google's "This event / This and following events" for a repeating event (feature tasklist-repeating).
 * The same words for every repeat rhythm. Built like `ConfirmDialog`. A `question` about how the list repeats offers
 * This and all following / All task lists instead (Google: "This and following events" / "All events") and says before
 * saving when lists changed on their own would be lost.
 */
import { ref, watch } from 'vue';
import type { ChangeScope } from '@/api/types';
import type { RuleQuestion } from './repeatChange';
import { t } from '@/i18n';
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';
import Button from '@/components/m3/Button.vue';
import ListItem from '@/components/m3/ListItem.vue';
import Radio from '@/components/m3/Radio.vue';

/** `open`: a question is being asked. */
const props = defineProps<{ open: boolean; question?: RuleQuestion | null }>();
const emit = defineEmits<{ answer: [scope: ChangeScope | null] }>();

const choice = ref<ChangeScope>('this');
const options = (): { value: ChangeScope; label: string }[] => (props.question?.options ?? ['this', 'following'] as ChangeScope[])
  .map((value) => ({ value, label: t(`tasks.repeatScope.${value}`) }));
// every question starts on its first choice, as Google's starts on "This event"
watch(() => props.open, (o) => { if (o) choice.value = options()[0]!.value; });
const lost = (): boolean => !!props.question && choice.value !== 'this' && props.question.lost[choice.value] > 0;
</script>

<template>
  <AdaptiveSheet :open="open" :label="t('tasks.repeatScope.title')" testid="repeat-scope-dialog" @close="emit('answer', null)">
    <h2 class="t">{{ t('tasks.repeatScope.title') }}</h2>
    <div v-if="open" class="opts" role="radiogroup" :aria-label="t('tasks.repeatScope.title')">
      <ListItem v-for="o in options()" :key="o.value" tag="label" class="opt" :data-testid="`repeat-scope-${o.value}`" :data-checked="choice === o.value ? 'true' : undefined">
        <template #leading><Radio :model-value="choice" :value="o.value" name="repeat-scope" :label="o.label" @update:model-value="choice = $event as ChangeScope" /></template>
        {{ o.label }}
      </ListItem>
    </div>
    <p v-if="open && lost()" class="lost" data-testid="repeat-scope-lost">{{ t('tasks.repeatScope.lost') }}</p>
    <div class="actions">
      <Button variant="text" data-testid="repeat-scope-cancel" @click="emit('answer', null)">{{ t('tasks.dialog.cancel') }}</Button>
      <Button data-testid="repeat-scope-ok" @click="emit('answer', choice)">{{ t('tasks.repeatScope.ok') }}</Button>
    </div>
  </AdaptiveSheet>
</template>

<style scoped>
.t { margin: 8px 0 0; font: var(--md-sys-typescale-title-large); }
.opts { display: flex; flex-direction: column; margin-top: 12px; }
.opt { cursor: pointer; padding: 0 4px; gap: 4px; }
.lost { margin: 12px 4px 0; color: var(--md-sys-color-error); font: var(--md-sys-typescale-body-medium); }
.actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
/* Left-handed mode (phone): the primary action is at the bottom left. */
html[data-hand='left'][data-touch] .actions { flex-direction: row-reverse; }
</style>
