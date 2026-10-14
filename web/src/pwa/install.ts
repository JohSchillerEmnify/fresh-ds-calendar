import { computed, ref, shallowRef } from 'vue';
import { listen, type Disposer } from '@/lib/timers';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const IOS_KEY = 'cal.iosHintDismissed';
const deferred = shallowRef<BeforeInstallPromptEvent | null>(null);
const standalone = ref(false);
const iosDismissed = ref(false);
const ios = ref(false);

export function isStandalone(): boolean {
  return (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches)
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
/** Any iPhone, iPad or iPod browser, including iPadOS reporting a desktop Mac user agent. */
export function isIos(ua: string = navigator.userAgent, touchPoints: number = navigator.maxTouchPoints): boolean {
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);
}
export function isIosSafari(ua: string = navigator.userAgent): boolean {
  return /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

/** Android: show the in-app install button after `beforeinstallprompt` (and not when standalone). */
export const canInstall = computed(() => deferred.value !== null && !standalone.value);
/** iOS Safari, not standalone, not dismissed: show the "Add to Home Screen" hint. */
export const showIosHint = computed(() => ios.value && !standalone.value && !iosDismissed.value);

/** Registers install listeners; call once from the shell. Returns a disposer. */
export function initInstall(): Disposer {
  standalone.value = isStandalone();
  ios.value = isIosSafari();
  try { iosDismissed.value = localStorage.getItem(IOS_KEY) === '1'; } catch { iosDismissed.value = false; }
  const stops = [
    listen(window, 'beforeinstallprompt' as keyof WindowEventMap, (e) => {
      e.preventDefault();
      deferred.value = e as unknown as BeforeInstallPromptEvent;
    }),
    listen(window, 'appinstalled', () => { deferred.value = null; }),
  ];
  return () => stops.forEach((s) => s());
}

export async function promptInstall(): Promise<void> {
  const e = deferred.value;
  if (!e) return;
  deferred.value = null;
  await e.prompt();
}
export function dismissIosHint(): void {
  iosDismissed.value = true;
  try { localStorage.setItem(IOS_KEY, '1'); } catch { /* storage unavailable */ }
}
