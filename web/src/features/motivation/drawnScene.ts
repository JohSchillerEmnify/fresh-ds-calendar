/**
 * Shapes of a drawn theme scene (ARCHITECTURE "Theme engine and AI themes"): the app draws the decor of a
 * `{ gradient, decor, density }` scene from building blocks, in a fixed pseudo-random layout per decor (so a scene
 * looks the same on every render). Pure data; `DrawnScene.vue` renders it as SVG.
 */
import type { ThemeDecor, ThemeDensity } from '@calendar/shared';

export const SCENE_W = 1200;
export const SCENE_H = 120;
/** Shapes per density; for waves and hills the number of layers. */
export const DENSITY_COUNT: Record<ThemeDensity, number> = { low: 8, medium: 16, high: 28 };
const LAYERS: Record<ThemeDensity, number> = { low: 1, medium: 2, high: 3 };

export interface Shape {
  tag: 'circle' | 'path' | 'rect' | 'ellipse';
  attrs: Record<string, string | number>;
  /** Subtle motion class, only active at the Full animation level: twinkle, float or drift. */
  motion?: 'tw' | 'fl' | 'dr';
  /** Animation delay in seconds, so shapes do not move in step. */
  delay: number;
}

/** Small seeded generator (mulberry32): the same decor always gives the same layout. */
function rng(seed: string): () => number {
  let a = 0;
  for (const ch of seed) a = (Math.imul(a, 31) + ch.charCodeAt(0)) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const star4 = (s: number) => `M0 ${-s}Q0 0 ${s} 0Q0 0 0 ${s}Q0 0 ${-s} 0Q0 0 0 ${-s}Z`;
const heart = (s: number) => `M0 ${s * 0.35}C${-s} ${-s * 0.4} ${-s * 0.5} ${-s} 0 ${-s * 0.45}C${s * 0.5} ${-s} ${s} ${-s * 0.4} 0 ${s * 0.35}Z`;

/** Layered wave or hill band at the bottom: `bumps` bumps of height up to `amp`, base line `y`. */
function band(r: () => number, kind: 'waves' | 'hills', layer: number, layers: number): string {
  const y = SCENE_H - 14 - (layers - 1 - layer) * 12 - (kind === 'hills' ? 6 : 0);
  const bumps = kind === 'waves' ? 6 + layer : 3 + layer;
  const step = (SCENE_W + 400) / bumps;
  const amp = kind === 'waves' ? 7 + r() * 5 : 18 + r() * 12;
  let d = `M-200 ${y}`;
  for (let i = 0; i < bumps; i++) {
    const x = -200 + i * step;
    d += kind === 'waves'
      ? `Q${x + step / 2} ${y - amp * (i % 2 ? -1 : 1)} ${x + step} ${y}`
      : `C${x + step * 0.25} ${y - amp * (0.6 + r() * 0.8)} ${x + step * 0.75} ${y - amp * (0.6 + r() * 0.8)} ${x + step} ${y}`;
  }
  return `${d}V${SCENE_H}H-200Z`;
}

/** The shapes of a decor at a density; `colors` are the gradient colours (confetti and the bands use them). */
export function drawDecor(decor: ThemeDecor, density: ThemeDensity, colors: string[]): Shape[] {
  const r = rng(decor);
  const n = DENSITY_COUNT[density];
  const out: Shape[] = [];
  const at = (y0 = 4, y1 = SCENE_H - 14) => ({ x: Math.round(r() * SCENE_W), y: Math.round(y0 + r() * (y1 - y0)) });
  const base = colors[colors.length - 1] ?? '#808080';
  switch (decor) {
    case 'stars':
      for (let i = 0; i < n; i++) { const p = at(); out.push({ tag: 'circle', attrs: { cx: p.x, cy: p.y, r: +(0.8 + r() * 1.4).toFixed(1), fill: '#fff', opacity: +(0.5 + r() * 0.5).toFixed(2) }, motion: 'tw', delay: +(r() * 3).toFixed(1) }); }
      break;
    case 'sparkles':
      for (let i = 0; i < n; i++) { const p = at(); out.push({ tag: 'path', attrs: { d: star4(4 + r() * 6), transform: `translate(${p.x} ${p.y})`, fill: '#fff', opacity: +(0.6 + r() * 0.4).toFixed(2) }, motion: 'tw', delay: +(r() * 3).toFixed(1) }); }
      break;
    case 'waves':
    case 'hills': {
      const layers = LAYERS[density];
      for (let l = 0; l < layers; l++) out.push({ tag: 'path', attrs: { d: band(r, decor, l, layers), fill: `color-mix(in srgb, ${base} 70%, black)`, opacity: +(0.4 + (l + 1) * (0.5 / layers)).toFixed(2) }, motion: decor === 'waves' ? 'dr' : undefined, delay: l * 1.3 });
      break;
    }
    case 'hearts':
      for (let i = 0; i < n; i++) { const p = at(10, SCENE_H - 10); out.push({ tag: 'path', attrs: { d: heart(4 + r() * 5), transform: `translate(${p.x} ${p.y})`, fill: '#fff', opacity: +(0.55 + r() * 0.4).toFixed(2) }, motion: 'fl', delay: +(r() * 3).toFixed(1) }); }
      break;
    case 'clouds':
      for (let i = 0; i < Math.max(2, Math.round(n / 3)); i++) {
        const p = at(8, SCENE_H - 40);
        const w = 26 + r() * 22, d = +(r() * 4).toFixed(1);
        for (const [dx, dy, k] of [[0, 0, 1], [w * 0.55, 3, 0.8], [-w * 0.55, 4, 0.7]] as const) out.push({ tag: 'ellipse', attrs: { cx: p.x + dx, cy: p.y + dy, rx: w * k, ry: w * k * 0.4, fill: '#fff', opacity: 0.7 }, motion: 'dr', delay: d });
      }
      break;
    case 'confetti': {
      const palette = [...colors, '#ffffff', '#ffd54f'];
      for (let i = 0; i < n; i++) { const p = at(); out.push({ tag: 'rect', attrs: { x: p.x, y: p.y, width: 4, height: 8, rx: 1, fill: palette[i % palette.length]!, opacity: 0.9, transform: `rotate(${Math.round(r() * 180)} ${p.x} ${p.y})` }, motion: 'tw', delay: +(r() * 3).toFixed(1) }); }
      break;
    }
    case 'bubbles':
      for (let i = 0; i < n; i++) { const p = at(8, SCENE_H - 8); out.push({ tag: 'circle', attrs: { cx: p.x, cy: p.y, r: +(3 + r() * 7).toFixed(1), fill: '#fff', 'fill-opacity': 0.15, stroke: '#fff', 'stroke-opacity': 0.7, 'stroke-width': 1.2 }, motion: 'fl', delay: +(r() * 3).toFixed(1) }); }
      break;
  }
  return out;
}
