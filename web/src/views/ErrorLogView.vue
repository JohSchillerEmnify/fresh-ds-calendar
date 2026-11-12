<script setup lang="ts">
/** Settings › Error log (`/settings/error-log`, feature device-log): newest first; Share, Copy, Download (.json), Clear. */
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IconCloudUpload, IconContentCopyOutline as IconCopy, IconDeleteOutline as IconDelete, IconDownload, IconIosShare as IconShare } from '@/components/icons';
import Button from '@/components/m3/Button.vue';
import ButtonGroup from '@/components/m3/ButtonGroup.vue';
import Switch from '@/components/m3/Switch.vue';
import SettingRow from '@/components/settings/SettingRow.vue';
import SettingsBar from '@/components/settings/SettingsBar.vue';
import { t } from '@/i18n';
import { copyText } from '@/lib/copyText';
import { clearDeviceLog, deviceLog, downloadDeviceLog, exportDeviceLog, shareDeviceLog } from '@/lib/deviceLog';
import { sendDeviceLog, sendNewEntriesIfOn } from '@/lib/deviceLogUpload';
import { useSavePrefs } from '@/composables/useSaveSettings';
import { usePrefsStore } from '@/stores/prefs';
import { useUiStore } from '@/stores/ui';

const router = useRouter();
const ui = useUiStore();
const prefs = usePrefsStore();
const savePrefs = useSavePrefs();
/** What the Send button did last: shown next to the buttons, so the person sees that it arrived (or did not). */
const sendStatus = ref<'' | 'sending' | 'sent' | 'failed'>('');
const field = ref<HTMLTextAreaElement | null>(null);
const text = ref('');
const entries = computed(() => [...deviceLog.value].reverse());
const pad = (n: number) => String(n).padStart(2, '0');
/** Local date and time to the second: the person compares it with when they saw the problem. */
const when = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

async function copy() {
  text.value = exportDeviceLog();
  // the legacy copy (plain http) selects the hidden field, which needs the text in it first
  await new Promise((r) => requestAnimationFrame(r));
  ui.notify(t(await copyText(text.value, field.value) ? 'deviceLog.copied' : 'deviceLog.copyFailed'));
}

/** Runs Share or Download; when nothing could leave the device, copies the log and says so, so the button never does nothing. */
async function leave(how: () => Promise<string>) {
  if (await how() !== 'failed') return;
  text.value = exportDeviceLog();
  await new Promise((r) => requestAnimationFrame(r));
  ui.notify(t(await copyText(text.value, field.value) ? 'deviceLog.sendCopied' : 'deviceLog.sendFailed'));
}

async function sendToServer() {
  sendStatus.value = 'sending';
  sendStatus.value = (await sendDeviceLog()) === 'failed' ? 'failed' : 'sent';
}

/** Switching it on sends what is new right away; off stops it (nothing is sent while it is off). */
async function setAuto(on: boolean) {
  await savePrefs({ sendReportsAuto: on });
  if (on) await sendNewEntriesIfOn(true);
}

function back() {
  if (window.history.state?.back) router.back();
  else router.push('/settings/account');
}
</script>

<template>
  <section class="page" data-testid="device-log-page">
    <SettingsBar :title="t('deviceLog.title')" back-testid="device-log-back" @back="back" />
    <div class="content">
      <section class="card">
        <p class="sub hint">{{ t('deviceLog.hint') }}</p>
        <div class="actions">
          <ButtonGroup :label="t('deviceLog.title')">
          <Button variant="tonal" :disabled="!entries.length" data-testid="device-log-share" @click="leave(shareDeviceLog)"><template #icon><IconShare /></template>{{ t('deviceLog.share') }}</Button>
          <Button variant="tonal" :disabled="!entries.length" data-testid="device-log-copy" @click="copy"><template #icon><IconCopy /></template>{{ t('deviceLog.copy') }}</Button>
          <Button variant="tonal" :disabled="!entries.length" data-testid="device-log-download" @click="leave(downloadDeviceLog)"><template #icon><IconDownload /></template>{{ t('deviceLog.download') }}</Button>
          </ButtonGroup>
          <Button variant="tonal" :disabled="!entries.length || sendStatus === 'sending'" data-testid="device-log-send" @click="sendToServer"><template #icon><IconCloudUpload /></template>{{ t('deviceLog.send') }}</Button>
          <Button variant="tonal" :disabled="!entries.length" data-testid="device-log-clear" @click="clearDeviceLog()"><template #icon><IconDelete /></template>{{ t('deviceLog.clear') }}</Button>
        </div>
        <p v-if="sendStatus === 'sent' || sendStatus === 'failed'" class="sub status" role="status" data-testid="device-log-send-status">{{ t(sendStatus === 'sent' ? 'deviceLog.sent' : 'deviceLog.sendNotSent') }}</p>
        <textarea ref="field" v-model="text" class="copy-field" readonly aria-hidden="true" tabindex="-1" />
      </section>
      <section class="card auto">
        <SettingRow id="sendReportsAuto" :label="t('deviceLog.auto.label')" :hint="t('deviceLog.auto.hint')">
          <Switch :model-value="prefs.sendReportsAuto" :label="t('deviceLog.auto.label')" data-testid="device-log-auto" @update:model-value="setAuto" />
        </SettingRow>
      </section>
      <section class="card">
        <p v-if="!entries.length" class="sub empty" data-testid="device-log-empty">{{ t('deviceLog.empty') }}</p>
        <ol v-else class="list">
          <li v-for="(e, i) in entries" :key="`${e.at}-${i}`" class="entry" data-testid="device-log-entry" :data-kind="e.kind">
            <span class="summary" data-testid="device-log-summary">{{ e.summary }}</span>
            <span class="sub meta">{{ when(e.at) }} · {{ t(`deviceLog.kind.${e.kind}`) }} · {{ e.app }} · {{ e.platform }}{{ e.standalone ? ` · ${t('deviceLog.standalone')}` : '' }}</span>
          </li>
        </ol>
      </section>
    </div>
  </section>
</template>

<style scoped>
.page { height: 100%; overflow-y: auto; overflow-x: clip; background: var(--md-sys-color-surface); padding-bottom: calc(24px + var(--safe-bottom)); }
.content { display: flex; flex-direction: column; gap: 12px; padding: 4px 12px 0; max-width: 640px; margin: 0 auto; }
.card { background: var(--md-sys-color-surface-container); border-radius: var(--md-sys-shape-corner-extra-large); padding: 12px; display: flex; flex-direction: column; gap: 8px; position: relative; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; }
.copy-field { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.entry { display: flex; flex-direction: column; gap: 2px; padding: 10px 4px; border-top: 1px solid var(--md-sys-color-outline-variant); }
.entry:first-child { border-top: 0; }
.summary { font: var(--md-sys-typescale-body-large); font-family: ui-monospace, monospace; font-size: 14px; overflow-wrap: anywhere; }
.sub { font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); margin: 0; }
.meta { font-size: 12px; overflow-wrap: anywhere; }
.hint, .empty, .status { padding: 0 4px; }
.auto { padding: 0; }
</style>
