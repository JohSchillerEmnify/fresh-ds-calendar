/**
 * Tiny damped-harmonic-oscillator spring solver (analytic, no integration drift).
 *
 * Parameters follow M3 Expressive: stiffness k (mass 1) and damping ratio zeta.
 *  zeta < 1  under-damped (bouncy), zeta = 1 critically damped, zeta > 1 over-damped.
 *
 * Used for: pre-computed CSS `linear()` easings for WAAPI (compositor), and a per-frame
 * follower (`Spring2D`) during drag only.
 */

export interface SpringParams {
  stiffness: number;
  /** Damping ratio (zeta). */
  damping: number;
  mass?: number;
}

/** Presets. Values from community M3 Expressive implementations (not official). */
export const springs = {
  /** Expressive spatial default: a visible but quick overshoot. */
  bouncy: { stiffness: 380, damping: 0.6 },
  /** Strong pop for the checkbox / celebration. */
  pop: { stiffness: 600, damping: 0.42 },
  /** Expressive spatial, restrained. */
  spatial: { stiffness: 380, damping: 0.78 },
  /** Fast, no visible overshoot (effects: opacity/colour). */
  effects: { stiffness: 1400, damping: 1 },
  /** Drop settle wobble. */
  wobble: { stiffness: 520, damping: 0.32 },
  /** Drag follow: slight lag, almost no overshoot. */
  follow: { stiffness: 900, damping: 0.82 },
  /** Gentle, for plant perk-up / bloom. */
  gentle: { stiffness: 180, damping: 0.5 },
} satisfies Record<string, SpringParams>;

/**
 * Displacement and velocity at time t (s) for a spring that starts at displacement d0
 * (relative to the target) with velocity v0 (units/s).
 */
export function springAt(p: SpringParams, d0: number, v0: number, t: number): { d: number; v: number } {
  const m = p.mass ?? 1;
  const w = Math.sqrt(p.stiffness / m);
  const z = p.damping;
  if (z < 1) {
    const wd = w * Math.sqrt(1 - z * z);
    const A = d0;
    const B = (v0 + z * w * A) / wd;
    const e = Math.exp(-z * w * t);
    const c = Math.cos(wd * t);
    const s = Math.sin(wd * t);
    const d = e * (A * c + B * s);
    const v = e * ((B * wd - z * w * A) * c - (A * wd + z * w * B) * s);
    return { d, v };
  }
  if (z === 1) {
    const A = d0;
    const B = v0 + w * A;
    const e = Math.exp(-w * t);
    return { d: (A + B * t) * e, v: (B - w * (A + B * t)) * e };
  }
  const sq = Math.sqrt(z * z - 1);
  const r1 = -w * (z - sq);
  const r2 = -w * (z + sq);
  const C2 = (v0 - r1 * d0) / (r2 - r1);
  const C1 = d0 - C2;
  const e1 = Math.exp(r1 * t);
  const e2 = Math.exp(r2 * t);
  return { d: C1 * e1 + C2 * e2, v: C1 * r1 * e1 + C2 * r2 * e2 };
}

/** Time (s) after which the normalised spring (0 -> 1) stays within `eps` of rest. */
export function settleTime(p: SpringParams, v0 = 0, eps = 0.001, max = 4): number {
  const dt = 1 / 120;
  let last = 0;
  for (let t = 0; t <= max; t += dt) {
    const { d, v } = springAt(p, -1, v0, t);
    if (Math.abs(d) > eps || Math.abs(v) > eps * 20) last = t;
  }
  return Math.min(max, last + dt);
}

/** Normalised progress samples 0..1(+overshoot) of a spring, evenly spaced in time. */
export function springSamples(p: SpringParams, n: number, v0 = 0): { values: number[]; duration: number } {
  const duration = settleTime(p, v0);
  const values: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = (duration * i) / (n - 1);
    values.push(1 + springAt(p, -1, v0, t).d);
  }
  values[0] = 0;
  values[n - 1] = 1;
  return { values, duration };
}

const easingCache = new Map<string, { easing: string; duration: number }>();

/**
 * CSS `linear()` easing + duration (ms) for a spring. Cached. Point count scales with duration
 * (~1 point / 16 ms, 12..64) which is visually exact for bounces.
 */
export function springEasing(p: SpringParams, v0 = 0): { easing: string; duration: number } {
  const key = `${p.stiffness}|${p.damping}|${p.mass ?? 1}|${v0}`;
  const hit = easingCache.get(key);
  if (hit) return hit;
  const dur = settleTime(p, v0);
  const n = Math.max(12, Math.min(64, Math.round((dur * 1000) / 16)));
  const { values } = springSamples(p, n, v0);
  const easing = supportsLinearEasing()
    ? `linear(${values.map((v) => +v.toFixed(4)).join(', ')})`
    : p.damping < 0.9
      ? 'cubic-bezier(0.34, 1.56, 0.64, 1)'
      : 'cubic-bezier(0.2, 0, 0, 1)';
  const out = { easing, duration: Math.round(dur * 1000) };
  easingCache.set(key, out);
  return out;
}

let linearSupport: boolean | null = null;
export function supportsLinearEasing(): boolean {
  if (linearSupport === null) {
    try {
      linearSupport =
        typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('animation-timing-function', 'linear(0, 1)');
    } catch {
      linearSupport = false;
    }
  }
  return linearSupport;
}
/** Test hook. */
export function __setLinearSupport(v: boolean | null): void {
  linearSupport = v;
  easingCache.clear();
}

/** A 1-D spring follower stepped per frame with the exact solution (stable for any dt). */
export class Spring1D {
  x: number;
  v = 0;
  target: number;
  constructor(
    public params: SpringParams,
    x = 0,
  ) {
    this.x = x;
    this.target = x;
  }
  /** Advances by dt seconds. Returns true while still moving. */
  step(dt: number): boolean {
    const r = springAt(this.params, this.x - this.target, this.v, Math.min(dt, 0.064));
    this.x = this.target + r.d;
    this.v = r.v;
    if (Math.abs(r.d) < 0.01 && Math.abs(r.v) < 0.5) {
      this.x = this.target;
      this.v = 0;
      return false;
    }
    return true;
  }
  snap(x: number): void {
    this.x = this.target = x;
    this.v = 0;
  }
}

/** Tracks pointer velocity (px/s) over a short window. */
export function createVelocityTracker(windowMs = 100) {
  const samples: { x: number; y: number; t: number }[] = [];
  return {
    add(x: number, y: number, t: number) {
      samples.push({ x, y, t });
      while (samples.length > 2 && t - samples[0].t > windowMs) samples.shift();
      if (samples.length > 8) samples.shift();
    },
    velocity(): { vx: number; vy: number } {
      if (samples.length < 2) return { vx: 0, vy: 0 };
      const a = samples[0];
      const b = samples[samples.length - 1];
      const dt = (b.t - a.t) / 1000;
      if (dt <= 0) return { vx: 0, vy: 0 };
      return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt };
    },
    reset() {
      samples.length = 0;
    },
  };
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
