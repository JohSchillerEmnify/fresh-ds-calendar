/**
 * Web Push in this browser (feature reminders, slice 2): the opt-in switch of Settings → Reminders
 * subscribes the browser with the server's VAPID key, and the reminder plan of the next 7 days is sent for it after every
 * sync (`transitionWarning.ts`). Not available where the browser has no `PushManager` or no secure context, nor in the
 * Android app (it has native notifications; no doubles).
 */
import { ref } from 'vue';
import { api, ApiError } from '@/api/client';
import type { PushPlanEntry } from '@/features/calendar/reminderPlan';

/** The push endpoint this browser is subscribed with, or null (not subscribed, or not known yet). */
export const pushEndpoint = ref<string | null>(null);

/** Whether the opt-in row is offered: a browser with push, in a secure context, outside the Android app. */
export function pushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'PushManager' in window && 'serviceWorker' in navigator && window.isSecureContext && 'Notification' in window && !('Capacitor' in window);
}

/** The server's public key (URL-safe base64) as the bytes `pushManager.subscribe` wants. */
function keyBytes(key: string): Uint8Array<ArrayBuffer> {
  const raw = atob(key.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(key.length / 4) * 4, '='));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** The browser's current subscription, if the service worker is registered and one exists. */
async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Reads whether this browser is subscribed (with the permission still granted) into {@link pushEndpoint}. */
export async function refreshPushState(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const sub = await currentSubscription();
    pushEndpoint.value = sub && Notification.permission === 'granted' ? sub.endpoint : null;
  } catch {
    pushEndpoint.value = null;
  }
}

/** Result of {@link enablePush}: subscribed, the permission was refused, or something else failed. */
export type EnablePush = 'on' | 'denied' | 'failed';

/** Asks for the permission, subscribes this browser and tells the server. */
export async function enablePush(): Promise<EnablePush> {
  try {
    if ((await Notification.requestPermission()) !== 'granted') return 'denied';
    const reg = await navigator.serviceWorker.ready;
    const { key } = await api.pushKey();
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
    await api.pushSubscribe(sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
    pushEndpoint.value = sub.endpoint;
    return 'on';
  } catch {
    return 'failed';
  }
}

/** Unsubscribes this browser and tells the server. */
export async function disablePush(): Promise<void> {
  const sub = await currentSubscription().catch(() => null);
  const endpoint = sub?.endpoint ?? pushEndpoint.value;
  pushEndpoint.value = null;
  await sub?.unsubscribe().catch(() => undefined);
  if (endpoint) await api.pushUnsubscribe(endpoint);
}

/**
 * Drops this browser's push subscription at the push service (used by sign-out, so the next person on a shared device is not
 * subscribed under someone else's name).
 *
 * @returns The endpoint that was subscribed (the server deletes it with the session), or null when there was none.
 */
export async function dropPushSubscription(): Promise<string | null> {
  if (!pushSupported()) return null;
  const sub = await currentSubscription().catch(() => null);
  const endpoint = sub?.endpoint ?? pushEndpoint.value;
  pushEndpoint.value = null;
  await sub?.unsubscribe().catch(() => undefined);
  return endpoint;
}

/**
 * Replaces this browser's plan on the server. When the server does not know the subscription (404, e.g. after a sign-out
 * or a new server) nothing is registered again: a browser subscribes only through the person's own switch in Settings, never
 * silently, so a shared device never reminds the wrong person.
 *
 * @returns Whether the server has the plan now.
 */
export async function sendPushPlan(endpoint: string, plan: PushPlanEntry[]): Promise<boolean> {
  try {
    await api.putReminderPlan(endpoint, plan);
    return true;
  } catch (e) {
    // the switch shows what is true: off, until the person turns it on again
    if (e instanceof ApiError && e.status === 404) pushEndpoint.value = null;
    return false;
  }
}
