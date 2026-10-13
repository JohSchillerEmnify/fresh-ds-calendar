<script setup lang="ts">
/**
 * "Create your own" part of the theme menu: the AI prompt to copy (no AI is called), and the import of the theme
 * file the AI answers with, by paste or file. The document is checked with the shared validator, its scene SVGs are
 * sanitised here again (the server does it once more), a preview shows how it looks, and saving stores it per person.
 */
import { computed, ref } from 'vue';
import { MAX_THEME_BYTES, sanitizeTheme, validateTheme, type ThemeDoc } from '@calendar/shared';
import { ApiError } from '@/api/client';
import Button from '@/components/m3/Button.vue';
import TextField from '@/components/m3/TextField.vue';
import ThemeCard from '@/components/settings/ThemeCard.vue';
import { useThemeStore } from '@/stores/theme';
import { useUiStore } from '@/stores/ui';
import { themePrompt } from '@/theme/aiPrompt';
import { docToResolved } from '@/theme/presets';
import { loadSvgSanitizer } from '@/theme/svg';

const theme = useThemeStore();
const ui = useUiStore();

const aiOpen = ref(false);
const prompt = themePrompt();
async function copyPrompt() {
  try {
    await navigator.clipboard.writeText(prompt);
    ui.notify('Prompt copied');
  } catch {
    ui.notify('Could not copy: select the prompt and copy it by hand');
  }
}

const text = ref('');
const errors = ref<string[]>([]);
/** The checked, sanitised document waiting to be saved; `removed`: unsafe parts were taken out of its picture. */
const checked = ref<{ doc: ThemeDoc; removed: boolean } | null>(null);
const saving = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

/** Checks the pasted text: JSON, schema, then the scene pictures. */
async function check() {
  checked.value = null;
  let json: unknown;
  try {
    json = JSON.parse(text.value);
  } catch (e) {
    errors.value = [`This is not valid JSON: ${(e as Error).message}`];
    return;
  }
  const valid = validateTheme(json);
  if (!valid.ok) { errors.value = valid.errors; return; }
  const safe = sanitizeTheme(await loadSvgSanitizer(), valid.doc);
  if (!safe.ok) { errors.value = safe.errors; return; }
  errors.value = [];
  checked.value = { doc: safe.doc, removed: safe.removed };
}

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  checked.value = null;
  if (file.size > MAX_THEME_BYTES) { errors.value = [`The file is larger than ${MAX_THEME_BYTES / 1024} KB`]; return; }
  text.value = await file.text();
  await check();
}

const preview = computed(() => (checked.value ? docToResolved(checked.value.doc) : null));

async function save() {
  if (!checked.value || saving.value) return;
  saving.value = true;
  try {
    await theme.importTheme(checked.value.doc);
    ui.notify(`Saved theme: ${checked.value.doc.name}`);
    text.value = '';
    checked.value = null;
  } catch (e) {
    errors.value = [e instanceof ApiError ? e.userMessage : 'Could not save the theme'];
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="own" aria-labelledby="h-own" role="group">
    <h3 id="h-own">Your own theme</h3>
    <div class="row">
      <Button variant="tonal" data-testid="theme-ai" :aria-expanded="aiOpen" @click="aiOpen = !aiOpen">Create with AI</Button>
    </div>
    <div v-if="aiOpen" class="ai">
      <p class="hint">Copy this prompt into the AI you like, add your wishes at the end, and import the theme file it answers with below.</p>
      <pre class="prompt" data-testid="theme-ai-prompt" tabindex="0">{{ prompt }}</pre>
      <Button variant="outlined" data-testid="theme-ai-copy" @click="copyPrompt">Copy prompt</Button>
    </div>

    <TextField v-model="text" class="paste" label="Paste the theme file" multiline :rows="5" data-testid="theme-import-text" autocomplete="off" autocapitalize="off" spellcheck="false" />
    <div class="row">
      <Button variant="tonal" data-testid="theme-import-submit" :disabled="!text.trim()" @click="check">Check theme</Button>
      <Button variant="outlined" @click="fileInput?.click()">Choose file</Button>
      <input ref="fileInput" type="file" accept=".json,application/json" hidden data-testid="theme-import-file" @change="onFile" />
    </div>

    <ul v-if="errors.length" class="errors" role="alert">
      <li v-for="e in errors" :key="e" data-testid="theme-import-error">{{ e }}</li>
    </ul>

    <div v-if="preview && checked" class="preview" data-testid="theme-import-preview" :data-name="checked.doc.name">
      <ThemeCard :name="checked.doc.name" :theme="preview" class="pcard" />
      <p v-if="checked.removed" class="hint" data-testid="theme-import-sanitized">Unsafe content was removed from the theme picture.</p>
    </div>
    <div class="row">
      <Button data-testid="theme-import-save" :disabled="!checked || saving" @click="save">Save theme</Button>
    </div>
  </div>
</template>

<style scoped>
.own { margin-top: 12px; }
h3 { margin: 0; padding: 12px 4px 4px; font: var(--md-sys-typescale-label-large); }
.row { display: flex; flex-wrap: wrap; gap: 8px; padding: 8px 0; }
.hint { margin: 4px; font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
.prompt { margin: 4px 0 8px; padding: 10px 12px; max-height: 220px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font: 12px/16px ui-monospace, monospace; border-radius: var(--md-sys-shape-corner-medium); background: var(--md-sys-color-surface-container); }
.paste { margin-top: 8px; }
.errors { margin: 4px 0; padding: 0 0 0 20px; color: var(--md-sys-color-error); font: var(--md-sys-typescale-body-medium); }
.preview { padding: 4px 0; }
.pcard { max-width: 220px; }
</style>
