import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { createAppRouter } from './router';
import { enableTimerCounting } from './lib/timers';
import { useClockStore } from './stores/clock';
import { useSettingsStore } from './stores/settings';
import { registerServiceWorker } from './pwa/register';
import { registerBuiltinExtensions } from './extensions/builtin';
import './styles.css';

async function bootstrap() {
  const pinia = createPinia();
  const app = createApp(App);
  app.use(pinia);

  // "today" and the settings (theme, default view) are needed before the first route resolves.
  const clock = useClockStore();
  const settings = useSettingsStore();
  const budget = AbortSignal.timeout(4000);
  await Promise.allSettled([clock.load(budget), settings.load(budget)]);
  if (clock.config.testMode) enableTimerCounting();
  settings.installAppearance();
  registerBuiltinExtensions();

  const router = createAppRouter();
  app.use(router);
  await router.isReady();
  app.mount('#app');
  void registerServiceWorker();
}

void bootstrap();
