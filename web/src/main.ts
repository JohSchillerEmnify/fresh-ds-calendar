import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { applyLanguage, cachedLanguagePref } from './i18n';
import { createAppRouter } from './router';
import { enableTimerCounting } from './lib/timers';
import { useAuthStore } from './stores/auth';
import { useClockStore } from './stores/clock';
import { useSettingsStore } from './stores/settings';
import { pushWidget } from './stores/sync';
import { useThemeStore } from './stores/theme';
import { registerServiceWorker } from './pwa/register';
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
  const budget = AbortSignal.timeout(4000);
  await Promise.allSettled([clock.load(budget), settings.load(budget), useThemeStore().load(budget)]);
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
}

void bootstrap();
