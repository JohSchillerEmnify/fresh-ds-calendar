<script setup lang="ts">
/** The email field of every "Share with" (task list and category): suggests only the addresses this person typed before or who share with them, from the device copy. */
import { computed, onMounted, useAttrs, useId } from 'vue';
import TextField from '@/components/m3/TextField.vue';
import { usePeople } from '@/composables/usePeople';
import { t } from '@/i18n';

defineOptions({ inheritAttrs: false });
defineProps<{ modelValue: string }>();
defineEmits<{ 'update:modelValue': [v: string] }>();
const { people, refresh } = usePeople();
const attrs = useAttrs();
// the class styles the wrapper (the parent's `.grow`); everything else, the test hook included, belongs to the input
const inputAttrs = computed(() => { const rest = { ...attrs }; delete rest.class; return rest; });
const listId = `share-suggestions-${useId()}`;
// the server's answer is kept on the device; offline the device copy stays
onMounted(() => { void refresh(); });
</script>

<template>
  <div :class="$attrs.class">
    <TextField
      v-bind="inputAttrs" :model-value="modelValue" :label="t('sharing.title')" type="email" inputmode="email" autocomplete="off" autocapitalize="none" spellcheck="false" :list="listId"
      @update:model-value="$emit('update:modelValue', $event)"
    />
    <datalist :id="listId" data-testid="share-suggestions">
      <option v-for="p in people" :key="p.email" :value="p.email">{{ p.name }}</option>
    </datalist>
  </div>
</template>
