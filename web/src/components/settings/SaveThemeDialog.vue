<script setup lang="ts">
/** Asks for a name and saves the look in use as an own theme (see `lookToDoc`); the new theme becomes the chosen one. */
import { ref } from 'vue';
import { validateThemeIssues } from '@calendar/shared';
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';
import Button from '@/components/m3/Button.vue';
import TextField from '@/components/m3/TextField.vue';
import { useAsyncSubmit } from '@/composables/useAsyncSubmit';
import { t } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { useThemeStore } from '@/stores/theme';
import { useUiStore } from '@/stores/ui';
import { issueText } from '@/theme/issueText';
import { lookToDoc, uniqueName } from '@/theme/saveLook';

const emit = defineEmits<{ close: [] }>();
const theme = useThemeStore();
const settings = useSettingsStore();
const ui = useUiStore();

const name = ref(uniqueName(t('theme.saveOwn.defaultName'), theme.themes.map((t) => t.doc.name)));
const { busy: saving, error, run } = useAsyncSubmit({ onDone: () => emit('close') });

async function save() {
  if (!name.value.trim()) { error.value = t('theme.saveOwn.nameRequired'); return; }
  const named = uniqueName(name.value.trim(), theme.themes.map((t) => t.doc.name));
  const { doc, picture } = lookToDoc(theme.resolved, { mode: settings.settings.themeMode, seed: settings.settings.seedColor }, named);
  const valid = validateThemeIssues(doc);
  if (!valid.ok) { error.value = issueText(valid.issues[0]!); return; }
  await run(async () => {
    await theme.importTheme(doc, picture);
    ui.notify(t('theme.saveOwn.saved', { name: doc.name }));
  }, 'theme.saveOwn.failed');
}
</script>

<template>
  <AdaptiveSheet :open="true" :label="t('theme.saveOwn.title')" testid="theme-save-dialog" @close="emit('close')">
    <form class="f" novalidate @submit.prevent="save">
      <h2 class="t">{{ t('theme.saveOwn.title') }}</h2>
      <p class="hint">{{ t('theme.saveOwn.hint') }}</p>
      <TextField v-model="name" :label="t('theme.saveOwn.name')" data-testid="theme-save-name" maxlength="40" autocomplete="off" :error="error" error-testid="theme-save-error" />
      <div class="actions">
        <span class="sp" />
        <Button variant="text" data-testid="theme-save-cancel" @click="emit('close')">{{ t('theme.saveOwn.cancel') }}</Button>
        <Button type="submit" :disabled="saving" data-testid="theme-save-confirm">{{ t('theme.saveOwn.save') }}</Button>
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
