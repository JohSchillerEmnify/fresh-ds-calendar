<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';

/** Small, non-blocking toast. Auto-hides after 4 s. Shown at every animation level (text only). */
const props = defineProps<{ message: { id: number; text: string } | null }>();
const emit = defineEmits<{ hide: [] }>();
const shown = ref<string | null>(null);
let timer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.message?.id,
  () => {
    if (timer) clearTimeout(timer);
    timer = null;
    shown.value = props.message?.text ?? null;
    if (shown.value) {
      timer = setTimeout(() => {
        shown.value = null;
        timer = null;
        emit('hide');
      }, 4000);
    }
  },
  { immediate: true },
);
onBeforeUnmount(() => timer && clearTimeout(timer));
</script>

<template>
  <Transition name="st">
    <div v-if="shown" class="st" data-testid="streak-message" role="status" aria-live="polite">{{ shown }}</div>
  </Transition>
</template>

<style scoped>
.st { position: fixed; z-index: 80; left: 50%; top: calc(env(safe-area-inset-top, 0px) + 68px); transform: translateX(-50%); pointer-events: none;
  padding: 10px 18px; border-radius: 999px; background: var(--md-sys-color-inverse-surface, #322f35); color: var(--md-sys-color-inverse-on-surface, #f5eff7);
  font: 600 0.9rem/1.2 system-ui, sans-serif; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25); white-space: nowrap; }
.st-enter-active { transition: transform 380ms cubic-bezier(0.34, 1.5, 0.64, 1), opacity 200ms; }
.st-leave-active { transition: transform 220ms ease-in, opacity 220ms; }
.st-enter-from { opacity: 0; transform: translate(-50%, -14px) scale(0.9); }
.st-leave-to { opacity: 0; transform: translate(-50%, -8px); }
:global(html[data-motion='off']) .st-enter-active, :global(html[data-motion='off']) .st-leave-active { transition: none; }
:global(html[data-motion='reduced']) .st-enter-active { transition: opacity 140ms; }
:global(html[data-motion='reduced']) .st-enter-from { transform: translateX(-50%); }
</style>
