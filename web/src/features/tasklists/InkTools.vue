<script setup lang="ts">
/** The writing tools (feature handwritten-lists): ink or text switch, undo, eraser, colour; left-handed mode mirrors them. */
import { IconDraw, IconKeyboard, IconUndo, IconInkEraser } from '@/components/icons';
import IconButton from '@/components/m3/IconButton.vue';
import { t } from '@/i18n';
import { useInkStore } from '@/stores/ink';

withDefaults(defineProps<{ canUndo?: boolean; /** Undo, eraser and colours too (a writing area is there); else only the mode switch. */ tools?: boolean }>(), { tools: true });
const emit = defineEmits<{ undo: [] }>();
const ink = useInkStore();
/** The colour presets; `null` is the theme's text colour. */
const PRESETS: Array<{ id: 'default' | 'red' | 'blue' | 'green' | 'orange'; hex: string | null }> = [
  { id: 'default', hex: null }, { id: 'red', hex: '#d32f2f' }, { id: 'blue', hex: '#1565c0' }, { id: 'green', hex: '#2e7d32' }, { id: 'orange', hex: '#ef6c00' },
];
function pick(e: Event): void {
  ink.setColour((e.target as HTMLInputElement).value);
  ink.eraser = false;
}
</script>

<template>
  <div class="tools" role="toolbar" :aria-label="t('ink.area')" data-testid="ink-tools">
    <IconButton
      :label="t(ink.mode === 'ink' ? 'ink.mode.ink' : 'ink.mode.text')" data-testid="ink-mode" :data-mode="ink.mode"
      @click="ink.setMode(ink.mode === 'ink' ? 'text' : 'ink')"
    ><IconDraw v-if="ink.mode === 'ink'" data-testid="ink-mode-icon-pen" /><IconKeyboard v-else data-testid="ink-mode-icon-keyboard" /></IconButton>
    <template v-if="tools && ink.mode === 'ink'">
      <IconButton :label="t('ink.undo')" :disabled="!canUndo" data-testid="ink-undo" @click="emit('undo')"><IconUndo /></IconButton>
      <IconButton :label="t('ink.eraser')" :aria-pressed="ink.eraser" :class="{ on: ink.eraser }" data-testid="ink-eraser" @click="ink.eraser = !ink.eraser"><IconInkEraser /></IconButton>
      <span class="colours" role="group" :aria-label="t('ink.colour.label')">
        <button
          v-for="p in PRESETS" :key="p.id" type="button" class="dot" :class="{ on: ink.colour === p.hex }" :style="{ '--dot': p.hex ?? 'var(--md-sys-color-on-surface)' }"
          :aria-label="t(`ink.colour.preset.${p.id}`)" :aria-pressed="ink.colour === p.hex" :data-testid="`ink-color-${p.id}`" @click="ink.setColour(p.hex); ink.eraser = false"
        />
        <label class="dot custom" :class="{ on: ink.colour !== null && !PRESETS.some((p) => p.hex === ink.colour) }" :style="{ '--dot': ink.colour ?? 'transparent' }" :title="t('ink.colour.custom')">
          <input type="color" :value="ink.colour ?? '#000000'" :aria-label="t('ink.colour.custom')" data-testid="ink-color-custom" @input="pick" />
        </label>
      </span>
    </template>
  </div>
</template>

<style scoped>
.tools { display: flex; align-items: center; gap: 2px; flex-wrap: wrap; }
.on { background: var(--md-sys-color-secondary-container); }
.colours { display: inline-flex; align-items: center; gap: 6px; margin: 0 6px; }
.dot { width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--md-sys-color-outline-variant); background: var(--dot); padding: 0; position: relative; cursor: pointer; }
.dot.on { border-color: var(--md-sys-color-primary); box-shadow: 0 0 0 2px var(--md-sys-color-primary-container); }
.custom { overflow: hidden; background: conic-gradient(red, yellow, lime, aqua, blue, magenta, red); }
.custom.on { background: var(--dot); }
.custom input { opacity: 0; position: absolute; inset: 0; width: 100%; height: 100%; cursor: pointer; }
/* left-handed: the tool row is mirrored (decision G7) */
:global(html[data-hand='left'][data-touch]) .tools { flex-direction: row-reverse; }
</style>
