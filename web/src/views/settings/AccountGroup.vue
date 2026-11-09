<script setup lang="ts">
/** Settings group Account & app (docs/settings-tree.md): Google account, backup to Drive, install, what's new, version. */
import { computed, ref } from 'vue';
import { api, ApiError } from '@/api/client';
import Button from '@/components/m3/Button.vue';
import ConfirmDialog from '@/components/m3/ConfirmDialog.vue';
import IosInstallSheet from '@/components/settings/IosInstallSheet.vue';
import SettingRow from '@/components/settings/SettingRow.vue';
import { useSignOut } from '@/composables/useSignOut';
import { t } from '@/i18n';
import { androidAppLabelKey, downloadApk, isNativeApp } from '@/native/app';
import { isIos as detectIos, isStandalone } from '@/pwa/install';
import { shownVersion } from '@/pwa/version';
import { useAuthStore } from '@/stores/auth';
import { useBackupStore } from '@/stores/backup';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { useSyncStore } from '@/stores/sync';
import { useUiStore } from '@/stores/ui';

const auth = useAuthStore();
const clock = useClockStore();
const ui = useUiStore();
const items = useItemsStore();
const sync = useSyncStore();
const build = shownVersion();
// iPhones and iPads cannot install the Android app, so the download row is hidden there; they get the Home Screen instructions instead
const isIos = detectIos();
const showIosInstall = isIos && !isStandalone();
const installing = ref(false);

const backup = useBackupStore();
const confirmRestore = ref(false);
const { asking: askLeave, leave, unsent: outbox } = useSignOut();
void backup.load();
const backupText = computed(() => {
  const s = backup.status;
  if (!s) return '';
  if (s.state === 'failed') return t('backup.status.failed', { reason: s.error ?? '' });
  if (s.state === 'ok' && s.lastBackupAt) return t('backup.status.ok', { time: backup.formatTime(s.lastBackupAt, clock.timeZone) });
  return t('backup.status.never');
});
async function runBackup() {
  const r = await backup.backupNow();
  ui.notify(r.ok ? t('backup.done') : t('backup.failed', { reason: r.message }));
}
async function runRestore() {
  confirmRestore.value = false;
  const r = await backup.restore();
  if (!r.ok) ui.notify(r.message);
}

const isMock = computed(() => clock.config.provider === 'mock');
const resetting = ref(false);
async function resetDemo() {
  resetting.value = true;
  try {
    await api.resetDemoData();
    items.$reset();
    await sync.syncNow();
    ui.notify(t('settings.account.resetDemo.done'));
  } catch (e) {
    ui.notify(e instanceof ApiError ? e.userMessage : t('settings.account.resetDemo.failed'));
  } finally {
    resetting.value = false;
  }
}
</script>

<template>
  <template v-if="auth.status === 'in' || auth.calendarMissing">
    <h2>{{ t('settingsNav.sub.account') }}</h2>
    <SettingRow v-if="auth.status === 'in'" id="signOut" :label="t('settings.account.signedIn')" :hint="auth.email ?? ''">
      <Button variant="text" data-testid="settings-signout" @click="leave('one')">{{ t('settings.account.signOut') }}</Button>
    </SettingRow>
    <SettingRow v-if="auth.status === 'in'" id="signOutAll" :label="t('settings.account.signOutAll.label')" :hint="t('settings.account.signOutAll.hint')">
      <Button variant="text" data-testid="settings-signout-all" @click="leave('all')">{{ t('settings.account.signOutAll.button') }}</Button>
    </SettingRow>
    <SettingRow v-if="auth.calendarMissing" id="calendarAccess" :label="t('settings.account.calendarAccess.label')" :hint="t('settings.account.calendarAccess.hint')">
      <Button variant="tonal" data-testid="settings-calendar-access" @click="auth.grantCalendar()">{{ t('settings.account.calendarAccess.grant') }}</Button>
    </SettingRow>
  </template>

  <template v-if="backup.status?.available">
    <h2>{{ t('backup.label') }}</h2>
    <SettingRow v-if="backup.status.permission === 'missing'" id="backup" :label="t('backup.allow.label')">
      <template #sub><span class="sub" data-testid="settings-backup-status" data-state="off">{{ t('backup.allow.hint') }}</span></template>
      <Button variant="text" data-testid="settings-backup-allow" @click="backup.allow()">{{ t('backup.allow.button') }}</Button>
    </SettingRow>
    <SettingRow v-else id="backup" wide :label="t('backup.label')">
      <template #sub><span class="sub" data-testid="settings-backup-status" :data-state="backup.status.state" :data-last-backup="backup.status.lastBackupAt ?? ''">{{ backupText }}</span></template>
      <Button variant="text" :disabled="backup.busy !== null" data-testid="settings-backup-now" @click="runBackup">{{ t('backup.now') }}</Button>
      <Button variant="text" :disabled="backup.busy !== null" data-testid="settings-backup-restore" @click="confirmRestore = true">{{ t('backup.restore') }}</Button>
    </SettingRow>
  </template>

  <h2>{{ t('settingsNav.sub.app') }}</h2>
  <SettingRow v-if="showIosInstall" id="installApp" :label="t('settings.account.installApp.label')" :hint="t('settings.account.installApp.hint')">
    <Button variant="tonal" data-testid="settings-install-app" @click="installing = true">{{ t('settings.account.installApp.button') }}</Button>
  </SettingRow>
  <SettingRow v-if="!isIos" id="androidApp" :label="t(androidAppLabelKey(isNativeApp()))" :hint="t('settings.account.androidApp.hint')">
    <Button variant="tonal" data-testid="settings-android-app" @click="downloadApk">{{ t('settings.account.androidApp.download') }}</Button>
  </SettingRow>
  <SettingRow id="whatsNew" link :label="t('settings.account.whatsNew.label')" testid="settings-whats-new" @open="ui.openDialog('whats-new')" />
  <SettingRow id="errorLog" to="/settings/error-log" :label="t('deviceLog.row.label')" :hint="t('deviceLog.row.hint')" testid="settings-error-log" />
  <SettingRow id="version" :label="t('settings.account.version', { version: build.version })" :hint="build.sha || undefined" testid="settings-version" />
  <SettingRow v-if="clock.config.apk?.certSha256" id="appCert" :label="t('settings.account.appCert.label')" :hint="t('settings.account.appCert.hint')">
    <template #sub><span class="cert" data-testid="settings-app-cert">{{ clock.config.apk.certSha256 }}</span></template>
  </SettingRow>
  <SettingRow v-if="isMock" id="resetDemo" :label="t('settings.account.resetDemo.label')" :hint="t('settings.account.resetDemo.hint')">
    <Button variant="text" :disabled="resetting" data-testid="settings-reset-demo" @click="resetDemo">{{ t('settings.account.resetDemo.button') }}</Button>
  </SettingRow>

  <IosInstallSheet v-if="installing" @close="installing = false" />
  <ConfirmDialog :open="askLeave !== null" :title="t('outbox.signOutAsk', { count: outbox.count }, outbox.count)" :ok-label="t('outbox.signOutAnyway')" :cancel-label="t('outbox.stay')" @ok="leave(askLeave!, true)" @cancel="askLeave = null" />
  <ConfirmDialog :open="confirmRestore" :title="t('backup.restoreDialog.title')" :message="t('backup.restoreDialog.message')" :ok-label="t('backup.restoreDialog.ok')" @ok="runRestore" @cancel="confirmRestore = false" />
</template>

<style scoped>
.sub { font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
.cert { display: block; font-family: ui-monospace, monospace; font-size: 12px; overflow-wrap: anywhere; color: var(--md-sys-color-on-surface-variant); }
</style>
