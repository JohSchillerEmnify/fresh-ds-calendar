/**
 * Reward effects. All particles live in ONE overlay layer (`reward-layer`, pointer-events none).
 * Each effect is a `reward-effect` element with `data-kind`; it is removed when its animations
 * finish or after a hard timeout (1200 ms; the butterfly is its own component and exempt).
 * Caps: at most MAX_EFFECTS concurrent effects, at most MAX_PARTICLES particles overall.
 * Only created when the motion level is Full and the page is visible.
 */
import './effects.css';
import { getMotionLevel } from './level';
import { haptic } from './haptics';
import { playBling, playTick } from './sound';

export type EffectKind =
  | 'tick' | 'list-complete' | 'drop' | 'streak' | 'water' | 'grow' | 'perk-up' | 'bloom' | 'butterfly' | 'eye-open';

export interface Point { x: number; y: number }
export type Origin = Point | Element;

export const HARD_TIMEOUT_MS = 1200;
export const MAX_EFFECTS = 3;
export const MAX_PARTICLES = 48;

export interface EffectHandle {
  kind: EffectKind;
  root: HTMLElement;
  /** Remove now (idempotent). */
  end(): void;
}

interface Live extends EffectHandle { particles: number; timer: ReturnType<typeof setTimeout>; anims: Animation[] }

const live = new Set<Live>();
let layer: HTMLElement | null = null;

const GOLD = '#ffc83d';
const PALETTE = [GOLD, 'var(--md-sys-color-primary, #6750a4)', 'var(--md-sys-color-tertiary, #7d5260)', '#ff6fa5', '#5bd6a4', '#5bb8ff'];

export function pointOf(o: Origin): Point {
  if ('x' in o && typeof o.x === 'number' && !(o instanceof Element)) return o as Point;
  const r = (o as Element).getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function canSpawn(): boolean {
  if (typeof document === 'undefined') return false;
  if (getMotionLevel() !== 'full') return false;
  return !document.hidden;
}

function getLayer(): HTMLElement {
  if (!layer || !layer.isConnected) {
    layer = document.createElement('div');
    layer.className = 'reward-layer';
    layer.setAttribute('aria-hidden', 'true');
    layer.dataset.testid = 'reward-layer';
    document.body.appendChild(layer);
  }
  return layer;
}

function particlesLive(): number {
  let n = 0;
  live.forEach((e) => (n += e.particles));
  return n;
}

/** Number of live effects (tests). */
export function liveEffectCount(): number {
  return live.size;
}

export function clearEffects(): void {
  [...live].forEach((e) => e.end());
}

/** Create the effect element. Returns null when effects are disabled. */
export function openEffect(kind: EffectKind, at: Origin, ttl = HARD_TIMEOUT_MS): Live | null {
  if (!canSpawn()) return null;
  while (live.size >= MAX_EFFECTS) [...live][0].end();
  const p = pointOf(at);
  const root = document.createElement('div');
  root.className = 'reward-effect';
  root.dataset.testid = 'reward-effect';
  root.dataset.kind = kind;
  root.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
  getLayer().appendChild(root);
  const e: Live = {
    kind,
    root,
    particles: 0,
    anims: [],
    timer: setTimeout(() => e.end(), Math.min(ttl, HARD_TIMEOUT_MS)),
    end() {
      if (!live.has(e)) return;
      live.delete(e);
      clearTimeout(e.timer);
      e.anims.forEach((a) => {
        try { a.cancel(); } catch { /* ignore */ }
      });
      root.remove();
      if (live.size === 0 && layer) {
        layer.remove();
        layer = null;
      }
    },
  };
  live.add(e);
  return e;
}

/** A marker effect with no particles: the component animates itself; this only registers it. */
export function markEffect(kind: EffectKind, at: Origin, ttl = HARD_TIMEOUT_MS): EffectHandle | null {
  return openEffect(kind, at, ttl);
}

function rnd(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

function addParticle(e: Live, cls: string, style: Partial<CSSStyleDeclaration>, frames: Keyframe[], dur: number, delay = 0, easing = 'cubic-bezier(0.12, 0.7, 0.3, 1)'): void {
  const el = document.createElement('span');
  el.className = `rp ${cls}`;
  Object.assign(el.style, style);
  e.root.appendChild(el);
  e.particles++;
  if (typeof el.animate === 'function') {
    const a = el.animate(frames, { duration: dur, delay, easing, fill: 'both' });
    e.anims.push(a);
    a.finished.then(
      () => {
        el.remove();
        if (e.anims.every((x) => x.playState === 'finished')) e.end();
      },
      () => undefined,
    );
  }
}

function budget(want: number): number {
  return Math.max(0, Math.min(want, MAX_PARTICLES - particlesLive()));
}

export interface BurstOptions { kind?: EffectKind; count?: number; spread?: number; colors?: string[] }

/** Small star burst (tick, bloom, perk-up). */
export function spawnSparkle(at: Origin, o: BurstOptions = {}): EffectHandle | null {
  const e = openEffect(o.kind ?? 'tick', at, 700);
  if (!e) return null;
  const n = budget(o.count ?? Math.round(rnd(7, 10)));
  const spread = o.spread ?? 34;
  const colors = o.colors ?? [GOLD, '#ffe08a', 'var(--md-sys-color-tertiary, #7d5260)', '#ffffff'];
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + rnd(-0.3, 0.3);
    const d = spread * rnd(0.6, 1.15);
    const dx = Math.cos(ang) * d;
    const dy = Math.sin(ang) * d;
    const s = rnd(0.6, 1.2);
    addParticle(
      e,
      'rp-star',
      { background: colors[i % colors.length] },
      [
        { transform: 'translate(0,0) scale(0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx * 0.7}px,${dy * 0.7}px) scale(${s}) rotate(90deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${dx}px,${dy}px) scale(0) rotate(180deg)`, opacity: 0 },
      ],
      rnd(450, 620),
    );
  }
  playTick();
  return e;
}

/** Confetti shower (list-complete). Origin is clamped so the burst stays inside the viewport (375 px safe). */
export function spawnConfetti(at: Origin, o: BurstOptions = {}): EffectHandle | null {
  const raw = pointOf(at);
  const vw = typeof window !== 'undefined' ? window.innerWidth : 375;
  const spread = Math.min(o.spread ?? 150, vw / 2 - 12);
  const p = { x: Math.min(vw - spread / 2, Math.max(spread / 2, raw.x)), y: raw.y };
  const e = openEffect(o.kind ?? 'list-complete', p, 1200);
  if (!e) return null;
  const n = budget(o.count ?? 16);
  const colors = o.colors ?? PALETTE;
  for (let i = 0; i < n; i++) {
    const dx = rnd(-spread, spread) * 0.9;
    const up = rnd(60, 130);
    const fall = rnd(30, 90);
    const rot = rnd(-540, 540);
    addParticle(
      e,
      'rp-conf',
      { background: colors[i % colors.length] },
      [
        { transform: 'translate(0,0) rotate(0deg) scale(0.4)', opacity: 1 },
        { transform: `translate(${dx * 0.65}px,${-up}px) rotate(${rot * 0.5}deg) scale(1)`, opacity: 1, offset: 0.4, easing: 'cubic-bezier(0.3, 0, 0.8, 0.6)' },
        { transform: `translate(${dx}px,${-up + fall + 70}px) rotate(${rot}deg) scale(0.9)`, opacity: 0 },
      ],
      rnd(780, 1000),
      rnd(0, 90),
      'linear',
    );
  }
  haptic([8, 40, 12]);
  playBling();
  return e;
}

/** Drop bling: an expanding ring plus a few stars (drag-and-drop landing). */
export function spawnBling(at: Origin, o: BurstOptions = {}): EffectHandle | null {
  const e = openEffect(o.kind ?? 'drop', at, 800);
  if (!e) return null;
  addParticle(e, 'rp-ring', {}, [
    { transform: 'scale(0.3)', opacity: 0.9 },
    { transform: 'scale(1.9)', opacity: 0 },
  ], 460);
  const n = budget(o.count ?? 5);
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + 0.4;
    const d = rnd(22, 34);
    addParticle(
      e,
      'rp-star',
      { background: i % 2 ? '#ffe08a' : GOLD },
      [
        { transform: 'translate(0,0) scale(0)', opacity: 1 },
        { transform: `translate(${Math.cos(ang) * d}px,${Math.sin(ang) * d}px) scale(0.9)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${Math.cos(ang) * d * 1.3}px,${Math.sin(ang) * d * 1.3}px) scale(0)`, opacity: 0 },
      ],
      520,
    );
  }
  playBling();
  return e;
}

/** Droplets falling onto a target (plant watering). */
export function spawnDroplets(at: Origin, o: BurstOptions = {}): EffectHandle | null {
  const p = pointOf(at);
  const e = openEffect(o.kind ?? 'water', { x: p.x, y: p.y }, 900);
  if (!e) return null;
  const n = budget(o.count ?? 5);
  for (let i = 0; i < n; i++) {
    const x = rnd(-14, 14);
    addParticle(
      e,
      'rp-drop',
      {},
      [
        { transform: `translate(${x}px,-46px) scale(0.8)`, opacity: 0 },
        { transform: `translate(${x}px,-30px) scale(1)`, opacity: 1, offset: 0.2 },
        { transform: `translate(${x * 0.6}px,2px) scale(0.9)`, opacity: 1, offset: 0.78 },
        { transform: `translate(${x * 0.6}px,6px) scale(0.2)`, opacity: 0 },
      ],
      rnd(520, 660),
      i * 70,
      'cubic-bezier(0.4, 0, 0.9, 0.6)',
    );
  }
  return e;
}
