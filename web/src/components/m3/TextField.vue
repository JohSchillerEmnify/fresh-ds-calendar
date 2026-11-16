<script setup lang="ts">
import { computed, useAttrs, useId } from 'vue';

defineOptions({ inheritAttrs: false });
const props = defineProps<{
  modelValue: string; label: string; type?: string; error?: string; supporting?: string; multiline?: boolean; rows?: number;
  /** data-testid of the error text element. */
  errorTestid?: string;
  /** Inline (task item entry and editing): no floating label (`label` names the field), a placeholder, 56 px tall. */
  inline?: boolean;
  placeholder?: string;
  /** `outlined`: a 1 px outline with the label on it, for fields that sit beside outlined menu fields; default filled. */
  variant?: 'filled' | 'outlined';
}>();
const emit = defineEmits<{ 'update:modelValue': [v: string]; commit: [] }>();
const id = useId();
const attrs = useAttrs();
const rest = computed(() => { const { class: _c, style: _s, ...r } = attrs; return r; });
const hint = computed(() => props.error || props.supporting || '');
</script>

<template>
  <div class="tf" :style="$attrs.style as never" :class="[$attrs.class, { inline, outlined: variant === 'outlined', err: !!error, filled: modelValue !== '' || type === 'date' || type === 'time' || type === 'color' }]">
    <div class="box">
      <component
        :is="multiline ? 'textarea' : 'input'" :id="id" v-bind="rest" class="in" :type="multiline ? undefined : (type ?? 'text')" :rows="multiline ? (rows ?? 3) : undefined"
        :value="modelValue" :placeholder="inline ? placeholder : ' '" :aria-label="inline ? label : undefined" :aria-invalid="!!error" :aria-describedby="hint ? id + '-h' : undefined"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @blur="emit('commit')" @keydown.enter="!multiline && emit('commit')"
      />
      <label v-if="!inline" class="lbl" :for="id">{{ label }}</label>
    </div>
    <p v-if="hint" :id="id + '-h'" class="hint" :data-testid="error ? errorTestid : undefined" :role="error ? 'alert' : undefined">{{ hint }}</p>
  </div>
</template>

<style scoped>
/* 56 px at Comfortable, moved by the density shift (--s), never under 52 px so the floating label fits (MDC $minimum-height-for-filled-label) */
.tf { --h: max(52px, calc(56px + var(--md-density-shift))); --s: calc(var(--h) - 56px); min-width: 0; }
/* filled (_md-comp-filled-text-field): extra-small top corners, a 1 px active indicator at rest and 2 px in primary when focused */
.box { position: relative; background: var(--md-sys-color-surface-container-highest); border-radius: var(--md-sys-shape-corner-extra-small) var(--md-sys-shape-corner-extra-small) 0 0; box-shadow: inset 0 -1px 0 var(--md-sys-color-on-surface-variant); }
.box:focus-within { box-shadow: inset 0 -2px 0 var(--md-sys-color-primary); }
.in { width: 100%; min-width: 0; min-height: var(--h); background: transparent; border: 0; outline: 0; padding: calc(24px + var(--s) / 2) 16px 6px; font-size: 16px; line-height: 24px; resize: vertical; color: var(--md-sys-color-on-surface); }
.lbl { position: absolute; left: 16px; top: calc(16px + var(--s) / 2); font-size: 16px; line-height: 24px; color: var(--md-sys-color-on-surface-variant); pointer-events: none; transform-origin: left top; transition: transform var(--md-sys-motion-duration-short) var(--md-sys-motion-emphasized); }
.in[type='time'], .in[type='date'] { -webkit-appearance: none; appearance: none; text-align: left; }
.in:focus ~ .lbl, .in:not(:placeholder-shown) ~ .lbl, .filled .lbl { transform: translateY(-10px) scale(0.75); }
.in:focus ~ .lbl { color: var(--md-sys-color-primary); }
.hint { margin: 4px 16px 0; font: var(--md-sys-typescale-label-medium); color: var(--md-sys-color-on-surface-variant); }
.err .box { box-shadow: inset 0 -1px 0 var(--md-sys-color-error); }
.err .box:focus-within { box-shadow: inset 0 -2px 0 var(--md-sys-color-error); }
.err .hint, .err .in:focus ~ .lbl { color: var(--md-sys-color-error); }
/* outlined (_md-comp-outlined-text-field): extra-small corners, a 1 px outline and 2 px in primary when focused; the label rests on it */
.outlined .box { background: transparent; border-radius: var(--md-sys-shape-corner-extra-small); box-shadow: inset 0 0 0 1px var(--md-sys-color-outline); }
.outlined .box:focus-within { box-shadow: inset 0 0 0 2px var(--md-sys-color-primary); }
.outlined.err .box { box-shadow: inset 0 0 0 1px var(--md-sys-color-error); }
.outlined.err .box:focus-within { box-shadow: inset 0 0 0 2px var(--md-sys-color-error); }
.outlined .in { padding: calc(16px + var(--s) / 2) 16px; }
.outlined .lbl { left: 12px; padding: 0 4px; }
.outlined .in:focus ~ .lbl, .outlined .in:not(:placeholder-shown) ~ .lbl, .outlined.filled .lbl { transform: translateY(-24px) scale(0.75); background: var(--md-sys-color-surface-container); }
/* inline (task item entry and editing): the filled field without a floating label */
.inline .in { padding: 0 16px; font: var(--md-sys-typescale-body-large); }
.inline .in::placeholder { color: var(--md-sys-color-on-surface-variant); }
</style>
