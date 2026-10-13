<script setup lang="ts">
/**
 * The AI part of the theme menu (a Labs switch, ARCHITECTURE "Theme engine and AI themes"): the prompt to copy (no AI
 * is called), and the import of the theme file the AI answers with, by paste or file, plus an optional own SVG picture
 * for the top bar. The text is tidied (fence, Markdown links), checked with the shared validator, the picture is
 * sanitised here again (the server does it once more), a preview shows how it looks, and saving stores it per person.
 */
import { computed, ref } from 'vue';
import { MAX_PICTURE_BYTES, MAX_THEME_BYTES, sanitizePictureIssues, validatePictureIssues, validateThemeIssues, type ThemeDoc, type ThemePicture } from '@calendar/shared';
import { ApiError } from '@/api/client';
import Button from '@/components/m3/Button.vue';
import TextField from '@/components/m3/TextField.vue';
import ThemeCard from '@/components/settings/ThemeCard.vue';
import { t } from '@/i18n';
import { copyText } from '@/lib/copyText';
import { useThemeStore } from '@/stores/theme';
import { useUiStore } from '@/stores/ui';
import { themePrompt } from '@/theme/aiPrompt';
import { cleanAiText, repairPrompt } from '@/theme/importText';
import { issueText } from '@/theme/issueText';
import { docToResolved } from '@/theme/presets';
import { loadSvgSanitizer } from '@/theme/svg';

const theme = useThemeStore();
const ui = useUiStore();

const aiOpen = ref(false);
const prompt = themePrompt();
const promptField = ref<HTMLTextAreaElement | null>(null);
const repairField = ref<HTMLTextAreaElement | null>(null);
async function copy(text: string, field: HTMLTextAreaElement | null, done: string) {
  if (await copyText(text, field)) ui.notify(done);
  else ui.notify(t('theme.import.copyFailed'));
}

const text = ref('');
const pictureLight = ref('');
const pictureDark = ref('');
/** Problems with the theme text (the AI can repair these) and with the picture (it cannot). */
const docErrors = ref<string[]>([]);
const pictureErrors = ref<string[]>([]);
const errors = computed(() => [...docErrors.value, ...pictureErrors.value]);
/** The validator's English messages for the repair prompt (the AI reads English); null when the problem did not come from the validator. */
const repairLines = ref<string[] | null>(null);
const repair = computed(() => repairPrompt(text.value, repairLines.value ?? docErrors.value));
/** The checked document and sanitised picture waiting to be saved; `removed`: unsafe parts were taken out of the picture. */
const checked = ref<{ doc: ThemeDoc; picture?: ThemePicture; removed: boolean } | null>(null);
const saving = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const lightInput = ref<HTMLInputElement | null>(null);
const darkInput = ref<HTMLInputElement | null>(null);

/** Checks the pasted text (tidy, JSON, schema) and the picture, if there is one. */
async function check() {
  checked.value = null;
  docErrors.value = [];
  pictureErrors.value = [];
  repairLines.value = null;
  let json: unknown;
  try {
    json = JSON.parse(cleanAiText(text.value));
  } catch (e) {
    docErrors.value = [t('theme.import.notJson'), `(${(e as Error).message})`];
    return;
  }
  const valid = validateThemeIssues(json);
  if (!valid.ok) { docErrors.value = valid.issues.map(issueText); repairLines.value = valid.issues.map((i) => i.message); return; }
  let picture: ThemePicture | undefined;
  let removed = false;
  if (pictureLight.value.trim() || pictureDark.value.trim()) {
    const raw: ThemePicture = { ...(pictureLight.value.trim() ? { light: pictureLight.value } : {}), ...(pictureDark.value.trim() ? { dark: pictureDark.value } : {}) };
    const ok = validatePictureIssues(raw);
    const safe = ok.ok ? sanitizePictureIssues(await loadSvgSanitizer(), ok.picture) : ok;
    if (!safe.ok) { pictureErrors.value = safe.issues.map(issueText); return; }
    picture = safe.picture;
    removed = safe.removed;
  }
  checked.value = { doc: valid.doc, picture, removed };
}

/** Reads a chosen file into a field (size limit first); the theme file also re-checks, a picture does when there is a theme. */
async function onFile(e: Event, into: 'theme' | 'light' | 'dark') {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  checked.value = null;
  docErrors.value = [];
  pictureErrors.value = [];
  repairLines.value = null;
  const max = into === 'theme' ? MAX_THEME_BYTES : MAX_PICTURE_BYTES;
  if (file.size > max) {
    const msg = t(into === 'theme' ? 'theme.import.fileTooLarge' : 'theme.import.pictureTooLarge', { kb: max / 1024 });
    if (into === 'theme') docErrors.value = [msg]; else pictureErrors.value = [msg];
    return;
  }
  const content = await file.text();
  if (into === 'theme') text.value = content;
  else (into === 'light' ? pictureLight : pictureDark).value = content;
  if (text.value.trim()) await check();
}

const preview = computed(() => (checked.value ? docToResolved(checked.value.doc, checked.value.picture) : null));

async function save() {
  if (!checked.value || saving.value) return;
  saving.value = true;
  try {
    await theme.importTheme(checked.value.doc, checked.value.picture);
    ui.notify(t('theme.import.saved', { name: checked.value.doc.name }));
    text.value = pictureLight.value = pictureDark.value = '';
    checked.value = null;
  } catch (e) {
    pictureErrors.value = [e instanceof ApiError ? e.userMessage : t('theme.import.failed')];
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="own" aria-labelledby="h-own" role="group" data-testid="theme-own">
    <h3 id="h-own">{{ t('theme.import.title') }}</h3>
    <div class="row">
      <Button variant="tonal" data-testid="theme-ai" :aria-expanded="aiOpen" @click="aiOpen = !aiOpen">{{ t('theme.import.createWithAi') }}</Button>
    </div>
    <div v-if="aiOpen" class="ai">
      <p class="hint">{{ t('theme.import.aiHint') }}</p>
      <!-- a read-only field, not <pre>: Ctrl+A then selects the prompt only, and the http copy fallback can select it -->
      <textarea ref="promptField" class="prompt" data-testid="theme-ai-prompt" readonly rows="10" :aria-label="t('theme.import.promptLabel')" :value="prompt" />
      <Button variant="outlined" data-testid="theme-ai-copy" @click="copy(prompt, promptField, t('theme.import.promptCopied'))">{{ t('theme.import.copyPrompt') }}</Button>
    </div>

    <TextField v-model="text" class="paste" :label="t('theme.import.pasteLabel')" multiline :rows="5" data-testid="theme-import-text" autocomplete="off" autocapitalize="off" spellcheck="false" />
    <div class="row">
      <Button variant="tonal" data-testid="theme-import-submit" :disabled="!text.trim()" @click="check">{{ t('theme.import.check') }}</Button>
      <Button variant="outlined" @click="fileInput?.click()">{{ t('theme.import.chooseFile') }}</Button>
      <input ref="fileInput" type="file" accept=".json,.txt,application/json,text/plain" hidden data-testid="theme-import-file" @change="onFile($event, 'theme')" />
    </div>

    <h3>{{ t('theme.import.pictureTitle') }}</h3>
    <p class="hint">{{ t('theme.import.pictureHint') }}</p>
    <TextField v-model="pictureLight" class="paste" :label="t('theme.import.pictureLight')" multiline :rows="2" data-testid="theme-picture-text" autocomplete="off" autocapitalize="off" spellcheck="false" />
    <TextField v-model="pictureDark" class="paste" :label="t('theme.import.pictureDark')" multiline :rows="2" data-testid="theme-picture-dark-text" autocomplete="off" autocapitalize="off" spellcheck="false" />
    <div class="row">
      <Button variant="outlined" @click="lightInput?.click()">{{ t('theme.import.chooseSvg') }}</Button>
      <input ref="lightInput" type="file" accept=".svg,image/svg+xml" hidden data-testid="theme-picture-file" @change="onFile($event, 'light')" />
      <Button variant="outlined" @click="darkInput?.click()">{{ t('theme.import.chooseSvgDark') }}</Button>
      <input ref="darkInput" type="file" accept=".svg,image/svg+xml" hidden data-testid="theme-picture-dark-file" @change="onFile($event, 'dark')" />
    </div>

    <ul v-if="errors.length" class="errors" role="alert">
      <li v-for="e in errors" :key="e" data-testid="theme-import-error">{{ e }}</li>
    </ul>
    <div v-if="docErrors.length" class="repair">
      <textarea ref="repairField" class="prompt" data-testid="theme-repair-prompt" readonly rows="4" :aria-label="t('theme.import.repairLabel')" :value="repair" />
      <Button variant="outlined" data-testid="theme-repair-copy" @click="copy(repair, repairField, t('theme.import.repairCopied'))">{{ t('theme.import.copyRepair') }}</Button>
    </div>

    <div v-if="preview && checked" class="preview" data-testid="theme-import-preview" :data-name="checked.doc.name">
      <ThemeCard :name="checked.doc.name" :theme="preview" class="pcard" />
      <p v-if="checked.removed" class="hint" data-testid="theme-import-sanitized">{{ t('theme.import.sanitized') }}</p>
    </div>
    <div class="row">
      <Button data-testid="theme-import-save" :disabled="!checked || saving" @click="save">{{ t('theme.import.save') }}</Button>
    </div>
  </div>
</template>

<style scoped>
.own { margin-top: 12px; }
h3 { margin: 0; padding: 12px 4px 4px; font: var(--md-sys-typescale-label-large); }
.row { display: flex; flex-wrap: wrap; gap: 8px; padding: 8px 0; }
.hint { margin: 4px; font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
.prompt { display: block; box-sizing: border-box; width: 100%; margin: 4px 0 8px; padding: 10px 12px; max-height: 220px; overflow: auto; resize: vertical; white-space: pre-wrap; overflow-wrap: anywhere; font: 12px/16px ui-monospace, monospace; color: inherit; border: 0; border-radius: var(--md-sys-shape-corner-medium); background: var(--md-sys-color-surface-container); }
.paste { margin-top: 8px; }
.repair { margin: 4px 0; }
.errors { margin: 4px 0; padding: 0 0 0 20px; color: var(--md-sys-color-error); font: var(--md-sys-typescale-body-medium); }
.preview { padding: 4px 0; }
.pcard { max-width: 220px; }
</style>
