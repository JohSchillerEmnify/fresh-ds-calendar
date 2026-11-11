<script setup lang="ts">
/**
 * Settings › Account & app › iPhone widget (feature iphone-widget): names the device, makes its widget key and walks
 * through the seven steps of the setup. The key exists only in this sheet (inside the installer text) and cannot be
 * read again; the sheet polls the key list so "Widget connected" shows when the widget's first read arrives.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { ApiError } from '@/api/client';
import type { WidgetKeyCreated } from '@/api/types';
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';
import Button from '@/components/m3/Button.vue';
import TextField from '@/components/m3/TextField.vue';
import { dateLocale, t } from '@/i18n';
import { copyText } from '@/lib/copyText';
import { useClockStore } from '@/stores/clock';
import { usePrefsStore } from '@/stores/prefs';
import { useWidgetKeysStore } from '@/stores/widgetKeys';
import { SCRIPTABLE_ADD_URL, SCRIPTABLE_APP_STORE_URL, widgetInstaller } from '@calendar/shared/widget-installer';

const emit = defineEmits<{ close: [] }>();
const keys = useWidgetKeysStore();
const clock = useClockStore();
const prefs = usePrefsStore();

const name = ref('');
const error = ref('');
const busy = ref(false);
const created = ref<WidgetKeyCreated | null>(null);
const copied = ref(false);
const field = ref<HTMLTextAreaElement | null>(null);

const installer = computed(() => (created.value ? widgetInstaller(clock.config.publicUrl ?? window.location.origin, created.value.key, prefs.language) : ''));
const usedAt = computed(() => keys.keys.find((k) => k.id === created.value?.id)?.lastUsedAt ?? null);
const connected = computed(() => (usedAt.value && created.value
  ? t('iphoneWidget.guide.connected', { name: created.value.name, time: new Intl.DateTimeFormat(dateLocale(), { timeStyle: 'short', timeZone: clock.timeZone }).format(new Date(usedAt.value)) })
  : ''));

async function create() {
  if (!name.value.trim() || busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    created.value = await keys.create(name.value.trim());
  } catch (e) {
    error.value = e instanceof ApiError ? e.userMessage : t('iphoneWidget.failed');
  } finally {
    busy.value = false;
  }
}

async function copy() {
  copied.value = await copyText(installer.value, field.value);
}

function openScriptable() {
  window.location.href = SCRIPTABLE_ADD_URL;
}

// the widget's first read shows here without any new channel: the key list is read again every few seconds and on return to the app
const poll = () => { if (created.value && !usedAt.value) keys.refresh().catch(() => undefined); };
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => { timer = setInterval(poll, 4000); document.addEventListener('visibilitychange', poll); });
onBeforeUnmount(() => { clearInterval(timer); document.removeEventListener('visibilitychange', poll); });
</script>

<template>
  <AdaptiveSheet :open="true" :label="t('iphoneWidget.add')" testid="iphone-widget-sheet" @close="emit('close')">
    <div class="f">
      <h2 class="t">{{ t('iphoneWidget.add') }}</h2>
      <template v-if="!created">
        <TextField v-model="name" :label="t('iphoneWidget.nameLabel')" :error="error" maxlength="40" data-testid="iphone-widget-name" @commit="create" />
        <div class="actions"><Button :disabled="!name.trim() || busy" data-testid="iphone-widget-create" @click="create">{{ t('iphoneWidget.create') }}</Button></div>
      </template>
      <template v-else>
        <p class="hint" data-testid="iphone-widget-intro">{{ t('iphoneWidget.intro') }}</p>
        <ol class="steps" data-testid="iphone-widget-guide">
          <li>
            <span class="n" aria-hidden="true">1</span>
            <div class="body">
              <div class="act link" data-testid="iphone-widget-step-1"><span>{{ t('iphoneWidget.guide.s1') }}</span><Button variant="text" :href="SCRIPTABLE_APP_STORE_URL" data-testid="iphone-widget-get-scriptable">{{ t('iphoneWidget.guide.getScriptable') }}</Button></div>
              <p class="hint" data-testid="iphone-widget-step-1-expects">{{ t('iphoneWidget.guide.h1') }}</p>
            </div>
          </li>
          <li>
            <span class="n" aria-hidden="true">2</span>
            <div class="body"><div class="act" data-testid="iphone-widget-step-2"><Button variant="tonal" data-testid="iphone-widget-copy-installer" @click="copy">{{ t(copied ? 'iphoneWidget.guide.copied' : 'iphoneWidget.guide.copy') }}</Button></div></div>
          </li>
          <li>
            <span class="n" aria-hidden="true">3</span>
            <div class="body">
              <div class="act" data-testid="iphone-widget-step-3"><Button variant="tonal" data-testid="iphone-widget-open-scriptable" @click="openScriptable">{{ t('iphoneWidget.guide.open') }}</Button></div>
              <p class="hint" data-testid="iphone-widget-step-3-expects">{{ t('iphoneWidget.guide.h3') }}</p>
            </div>
          </li>
          <li v-for="n in [4, 5, 6, 7]" :key="n">
            <span class="n" aria-hidden="true">{{ n }}</span>
            <div class="body"><div class="act" :data-testid="`iphone-widget-step-${n}`"><span>{{ t(`iphoneWidget.guide.s${n}` as 'iphoneWidget.guide.s4') }}</span></div></div>
          </li>
        </ol>
        <p class="note" data-testid="iphone-widget-note">{{ t('iphoneWidget.guide.note') }}</p>
        <p v-if="connected" class="connected" role="status" data-testid="iphone-widget-connected">{{ connected }}</p>
        <textarea ref="field" class="sr" readonly tabindex="-1" aria-hidden="true" data-testid="iphone-widget-installer-text" :value="installer" />
        <div class="actions"><Button data-testid="iphone-widget-done" @click="emit('close')">{{ t('iphoneWidget.done') }}</Button></div>
      </template>
    </div>
  </AdaptiveSheet>
</template>

<style scoped>
.f { display: flex; flex-direction: column; gap: 12px; }
.t { margin: 8px 0 0; font: var(--md-sys-typescale-title-large); }
.steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; font: var(--md-sys-typescale-body-large); }
.steps li { display: flex; align-items: flex-start; gap: 16px; }
.n { flex: none; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); font: var(--md-sys-typescale-label-large); }
.body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.act { display: flex; flex-wrap: wrap; align-items: center; column-gap: 4px; min-height: 32px; }
.act.link { flex-direction: column; align-items: flex-start; }
.act.link :deep(.m3-btn) { margin-left: -12px; }
.hint, .note { margin: 0; font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
.connected { margin: 0; font: var(--md-sys-typescale-title-small); color: var(--md-sys-color-primary); }
.sr { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.actions { display: flex; justify-content: flex-end; margin-top: 4px; }
html[data-hand='left'] .actions { justify-content: flex-start; }
</style>
