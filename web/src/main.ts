import { createApp } from 'vue';
import { checkApk } from '@/native/apkHint';
import { createPinia } from 'pinia';
import App from './App.vue';
import { applyLanguage, cachedLanguagePref } from './i18n';
import { createAppRouter, warmView } from './router';
import { enableTimerCounting } from './lib/timers';
import { useAuthStore } from './stores/auth';
import { useClockStore } from './stores/clock';
import { useItemsStore } from './stores/items';
import { useOutboxStore } from './stores/outbox';
import { useDeviceStore } from './stores/device';
import { useSettingsStore } from './stores/settings';
import { pushWidget } from './stores/sync';
import { useThemeStore } from './stores/theme';
import { registerServiceWorker } from './pwa/register';
import { checkReleaseNotes } from './pwa/releaseNotes';
import { registerBuiltinExtensions } from './extensions/builtin';
import { installMotion } from './motion';
import './styles.css';
import './theme/theme.css';

async function bootstrap() {
  const pinia = createPinia();
  const app = createApp(App);
  app.use(pinia);

  // a refused session (401) on any of the first calls below sends the person to the sign-in page at once
  useAuthStore().listen();
  // "today" and the settings (theme, default view) are needed before the first route resolves.
  const clock = useClockStore();
  const settings = useSettingsStore();
  warmView(location.pathname);
  // the device store shows at once: then nothing below waits for the network (feature last-known-state)
  const device = useDeviceStore();
  const shown = await device.restore(location.pathname);
  // the changes made without a connection show again and are sent when sync runs
  if (location.pathname !== '/signin') {
    // the stores the outbox shows its changes through register with it when they are created
    useItemsStore();
    await useOutboxStore().load();
  }
  const budget = shown ? undefined : AbortSignal.timeout(4000);
  // the router guard asks the same question (once) right after; asking now saves a round trip
  const session = location.pathname === '/signin' ? undefined : useAuthStore().check();
  const loads = Promise.allSettled([clock.load(budget), settings.load(budget), useThemeStore().load(budget), session]);
  if (!shown) await loads;
  device.install();
  if (clock.config.testMode) enableTimerCounting();
  // the language chosen on this device last time (or the device's), before the first paint
  await applyLanguage(cachedLanguagePref());
  installMotion();
  settings.installAppearance();
  registerBuiltinExtensions();

  const router = createAppRouter();
  app.use(router);
  await router.isReady();
  app.mount('#app');
  void registerServiceWorker();
  pushWidget();
  // on start (later syncs check again through checkVersion); a browser never shows the hint
  void checkApk(clock.config.apk);
  void checkReleaseNotes();
}

void bootstrap();
