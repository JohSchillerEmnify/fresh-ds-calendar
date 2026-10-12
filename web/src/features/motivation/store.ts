import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ChangeKind, CheckInResult, Motivation } from './types';

export interface StartOptions {
  /** Local date (YYYY-MM-DD) of the APP clock (not the device clock). */
  today: () => string;
  fetchImpl?: typeof fetch;
}

/** Derive which effects a new Motivation should trigger relative to the previous one. */
export function diffMotivation(prev: Motivation | null, next: Motivation): ChangeKind[] {
  if (!prev) return [];
  const kinds: ChangeKind[] = [];
  if (next.plant.growth > prev.plant.growth) kinds.push('water');
  if (next.plant.stageIndex > prev.plant.stageIndex) kinds.push('grow');
  if (next.plant.flowers > prev.plant.flowers) kinds.push('bloom');
  if (prev.plant.mood !== 'happy' && next.plant.mood === 'happy') kinds.push('perk-up');
  return kinds;
}

/** Message for a check-in result, or null when nothing should be shown. Never shaming. */
export function checkInMessage(prev: Motivation | null, r: CheckInResult): string | null {
  if (!r.newToday) return null;
  if (r.current === 1 && prev?.streak.lastCheckIn) return 'Welcome back!';
  return `Checked in, day ${r.current}`;
}

export const useMotivationStore = defineStore('motivation', () => {
  const motivation = ref<Motivation | null>(null);
  /** Increments with every new-day check-in (drives the flame crackle). */
  const streakPulse = ref(0);
  const message = ref<{ id: number; text: string } | null>(null);
  const change = ref<{ id: number; kinds: ChangeKind[] } | null>(null);
  const error = ref<string | null>(null);

  let opts: StartOptions | null = null;
  let lastCheckInDay: string | null = null;
  let inflight: Promise<unknown> | null = null;
  let seq = 0;
  let onVis: (() => void) | null = null;
  let aborter: AbortController | null = null;

  const f = () => opts?.fetchImpl ?? fetch;

  async function json<T>(path: string, init?: RequestInit): Promise<T> {
    aborter ??= new AbortController();
    const res = await f()(path, { ...init, signal: aborter.signal, headers: { 'content-type': 'application/json' } });
    if (!res.ok) throw new Error(`${path} ${res.status}`);
    return (await res.json()) as T;
  }

  function apply(next: Motivation) {
    const kinds = diffMotivation(motivation.value, next);
    motivation.value = next;
    if (kinds.length) change.value = { id: ++seq, kinds };
  }

  async function load(): Promise<void> {
    try {
      apply(await json<Motivation>('/api/motivation'));
      error.value = null;
    } catch (e) {
      error.value = (e as Error).message;
    }
  }

  /** Call after mutation responses with `X-Motivation-Changed: 1`. */
  const refresh = load;

  async function checkIn(): Promise<void> {
    const day = opts?.today();
    if (day && day === lastCheckInDay) return;
    if (inflight) return void (await inflight);
    inflight = (async () => {
      try {
        if (!motivation.value) await load();
        const prev = motivation.value;
        const r = await json<CheckInResult>('/api/streak/checkin', { method: 'POST' });
        lastCheckInDay = day ?? null;
        apply(r.motivation);
        const text = checkInMessage(prev, r);
        if (text) {
          message.value = { id: ++seq, text };
          streakPulse.value++;
        }
      } catch (e) {
        error.value = (e as Error).message;
      } finally {
        inflight = null;
      }
    })();
    await inflight;
  }

  /** Begin: load + first-open check-in, and re-check when the app becomes visible on a new local day. */
  function start(o: StartOptions): Promise<void> {
    stop();
    opts = o;
    aborter = new AbortController();
    if (typeof document !== 'undefined') {
      onVis = () => {
        if (document.visibilityState === 'visible') void checkIn();
      };
      document.addEventListener('visibilitychange', onVis);
    }
    return checkIn();
  }

  function stop() {
    if (onVis) document.removeEventListener('visibilitychange', onVis);
    onVis = null;
    aborter?.abort();
    aborter = null;
    inflight = null;
  }

  function dismissMessage() {
    message.value = null;
  }

  return { motivation, streakPulse, message, change, error, start, stop, load, refresh, checkIn, dismissMessage };
});
