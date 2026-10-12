/**
 * Optional WebAudio blips. Off by default. The AudioContext is created lazily on the first
 * play after sounds were enabled (which happens after a user gesture), never on load.
 */
let on = false;
let ctx: AudioContext | null = null;

export function setSoundsEnabled(v: boolean): void {
  on = v;
  if (!v) closeAudio();
}
export function soundsEnabled(): boolean {
  return on;
}

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  const AC = (globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
  const Ctor = AC.AudioContext ?? AC.webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

export function closeAudio(): void {
  const c = ctx;
  ctx = null;
  try {
    void c?.close();
  } catch {
    /* ignore */
  }
}

function blip(freqs: number[], step: number, dur: number, gain: number): void {
  if (!on) return;
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state === 'suspended') void c.resume();
    const t0 = c.currentTime;
    freqs.forEach((f, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const s = t0 + i * step;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(gain, s + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
      o.connect(g).connect(c.destination);
      o.start(s);
      o.stop(s + dur + 0.02);
    });
  } catch {
    /* ignore */
  }
}

export const playTick = () => blip([880], 0, 0.09, 0.06);
export const playBling = () => blip([660, 990, 1320], 0.07, 0.16, 0.05);
