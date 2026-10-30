/** Pure rules of handwritten items (feature handwritten-lists): pointers, line-height units, outlines, erasing, colours. */
import { getStroke } from 'perfect-freehand';
import type { InkDoc, InkPoint, InkStroke } from '@calendar/shared/api';
import type { OutboxEntry } from './outbox';

/** What a pointer event does in the writing area. */
export type PenRole = 'draw' | 'erase' | 'ignore';

/** Only a pen draws; a finger only with "Draw with finger"; a mouse never (decision R1). The pen's eraser end or barrel button erases. */
export function penRole(e: { pointerType: string; buttons: number }, drawWithFinger: boolean): PenRole {
  if (e.pointerType === 'pen') return (e.buttons & 32) !== 0 || (e.buttons & 2) !== 0 ? 'erase' : 'draw';
  if (e.pointerType === 'touch') return drawWithFinger ? 'draw' : 'ignore';
  return 'ignore';
}

/** A pointer position as an ink point: line heights from the line's corner, so ink scales to any line (decision G8). */
export function toLineUnits(e: { clientX: number; clientY: number; pressure: number }, origin: { left: number; top: number }, lineHeight: number): InkPoint {
  // a pen that reports no pressure gives 0; keep a visible hairline
  const pressure = Math.min(1, Math.max(0.05, e.pressure));
  return [(e.clientX - origin.left) / lineHeight, (e.clientY - origin.top) / lineHeight, pressure];
}

const avg = (a: number[], b: number[]): [number, number] => [(a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2];
const r2 = (n: number): string => n.toFixed(3);

/** SVG path data of a stroke in line-height units; the width follows the pressure (decision Q4). */
export function strokePath(points: InkPoint[]): string {
  const outline = getStroke(points, { size: 0.12, thinning: 0.6, smoothing: 0.5, streamline: 0.4, simulatePressure: false, last: true });
  if (outline.length < 4) return '';
  let [a, b] = [outline[0]!, outline[1]!];
  const c = outline[2]!;
  let d = `M${r2(a[0]!)},${r2(a[1]!)} Q${r2(b[0]!)},${r2(b[1]!)} ${avg(b, c).map(r2).join(',')} T`;
  for (let i = 2; i < outline.length - 1; i++) {
    a = outline[i]!;
    b = outline[i + 1]!;
    d += `${avg(a, b).map(r2).join(',')} `;
  }
  return `${d}Z`;
}

/** Distance from a point to the segment a-b. */
function segmentDistance(x: number, y: number, a: InkPoint, b: InkPoint): number {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((x - a[0]) * dx + (y - a[1]) * dy) / len2));
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}

/** The strokes left after the eraser touched (x, y) within `radius` line heights. */
export function eraseAt(strokes: InkStroke[], x: number, y: number, radius: number): InkStroke[] {
  return strokes.filter((s) => !s.p.some((pt, i) => (i === 0 ? Math.hypot(x - pt[0], y - pt[1]) : segmentDistance(x, y, s.p[i - 1]!, pt)) <= radius));
}

/** Size of the strokes as the server counts it, against the list limit (decision Q3). */
export function inkBytes(strokes: InkStroke[]): number {
  return JSON.stringify(strokes).length;
}

const channel = (v: number): number => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const luminance = (hex: string): number => { const [r, g, b] = rgb(hex).map((v) => channel(v / 255)); return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!; };
const contrast = (a: number, b: number): number => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const toHex = (c: number[]): string => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** The ink colour moved towards white (dark theme) or black (light theme) until it reads on the background (decision Q4). */
export function readableInk(hex: string, dark: boolean): string {
  const bg = dark ? luminance('#1c1b1f') : luminance('#fffbfe');
  const target = dark ? [255, 255, 255] : [0, 0, 0];
  const base = rgb(hex);
  for (let k = 0; k <= 20; k++) {
    const mixed = toHex(base.map((v, i) => v + (target[i]! - v) * (k / 20)));
    if (contrast(luminance(mixed), bg) >= 4.5) return mixed;
  }
  return toHex(target);
}

/** The server's ink with the unsent changes of the outbox on top (writing offline shows at once; ADR 0031). */
export function withPendingInk(lists: InkDoc['lists'], entries: OutboxEntry[]): InkDoc['lists'] {
  let out = lists;
  for (const { change: c } of entries) {
    if ((c.op === 'item.add' && c.strokes) || c.op === 'item.ink') {
      out = { ...out, [c.id]: { ...out[c.id], [c.itemId]: c.strokes ?? [] } };
    }
  }
  return out;
}

/** Whether the writing area is the larger, ruled one: handwriting is on and a pen is (likely) used (decisions A6, R4, T1, Q9). */
export function isRuled(o: { enabled: boolean; penSeen: boolean; width: number; touch: boolean }): boolean {
  return o.enabled && (o.penSeen || (o.width >= 768 && o.touch));
}
