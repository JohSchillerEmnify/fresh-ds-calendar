<script setup lang="ts">
/** Asks for a name and saves the look in use as an own theme (see `lookToDoc`); the new theme becomes the chosen one. */
import { ref } from 'vue';
import { validateTheme } from '@calendar/shared';
import { ApiError } from '@/api/client';
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';
import Button from '@/components/m3/Button.vue';
import TextField from '@/components/m3/TextField.vue';
import { useSettingsStore } from '@/stores/settings';
import { useThemeStore } from '@/stores/theme';
import { useUiStore } from '@/stores/ui';
import { DEFAULT_THEME_NAME, lookToDoc, uniqueName } from '@/theme/saveLook';

const emit = defineEmits<{ close: [] }>();
const theme = useThemeStore();
const settings = useSettingsStore();
const ui = useUiStore();

const name = ref(uniqueName(DEFAULT_THEME_NAME, theme.themes.map((t) => t.doc.name)));
const error = ref('');
const saving = ref(false);

async function save() {
  if (!name.value.trim()) { error.value = 'Name is required'; return; }
  const named = uniqueName(name.value.trim(), theme.themes.map((t) => t.doc.name));
  const { doc, picture } = lookToDoc(theme.resolved, { mode: settings.settings.themeMode, seed: settings.settings.seedColor }, named);
  const valid = validateTheme(doc);
  if (!valid.ok) { error.value = valid.errors[0]!; return; }
  saving.value = true;
  try {
    await theme.importTheme(doc, picture);
    ui.notify(`Saved theme: ${doc.name}`);
    emit('close');
  } catch (e) {
    error.value = e instanceof ApiError ? e.userMessage : 'Could not save the theme';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <AdaptiveSheet :open="true" label="Save as my theme" testid="theme-save-dialog" @close="emit('close')">
    <form class="f" novalidate @submit.prevent="save">
      <h2 class="t">Save as my theme</h2>
      <p class="hint">Keeps the theme, your fine-tuning and the scene as a theme of your own.</p>
      <TextField v-model="name" label="Name" data-testid="theme-save-name" maxlength="40" autocomplete="off" :error="error" error-testid="theme-save-error" />
      <div class="actions">
        <span class="sp" />
        <Button variant="text" data-testid="theme-save-cancel" @click="emit('close')">Cancel</Button>
        <Button type="submit" :disabled="saving" data-testid="theme-save-confirm">Save</Button>
      </div>
    </form>
  </AdaptiveSheet>
</template>

<style scoped>
.f { display: flex; flex-direction: column; gap: 12px; }
.t { margin: 8px 0 0; font: var(--md-sys-typescale-title-large); }
.hint { margin: 0; font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
.actions { display: flex; align-items: center; gap: 8px; }
.sp { flex: 1; }
</style>
