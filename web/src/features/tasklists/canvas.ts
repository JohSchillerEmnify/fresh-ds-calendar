/**
 * Pure geometry of the Tasks view's Canvas (ARCHITECTURE "Canvas"): board and note sizes, clamping, the Unsorted stack,
 * which area a note lies in, zoom and pan maths and the remembered view. No store, DOM or network access, so the rules
 * are unit-tested with plain numbers. One canvas unit is one CSS pixel at zoom 1.
 */
import { format } from 'date-fns';
import type { CanvasArea, CanvasPlace } from '@/api/types';
import { dateLocale, language } from '@/i18n/language';
import { parseIsoDate } from '@/lib/dates';

/** Size of the board in canvas units. */
export const WORLD_W = 4000;
export const WORLD_H = 3000;
/** Width of a note; its height follows its items. */
export const NOTE_W = 240;
/** Height of the strip at a note's top edge that a note's anchor point sits in. */
export const NOTE_ANCHOR_Y = 24;
/** Zoom range (owner: "such as 0.3-2"). */
export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 2;
/** At least this many screen pixels of the board stay in view when panning. */
export const KEEP_VISIBLE = 120;
/** The Unsorted stack: first note at (24, 24), each next one 14 units further, the 11th and later share the last offset. */
export const STACK_ORIGIN = 24;
export const STACK_STEP = 14;
export const STACK_MAX = 10;
/** Area sizes (canvas units); the server accepts the same bounds (API.md "Canvas"). */
export const AREA_MIN_W = 160;
export const AREA_MIN_H = 120;
export const AREA_MAX = 4000;
export const AREA_W = 320;
export const AREA_H = 240;
/** Eight area colours, in the order new areas take them. */
export const AREA_COLORS = [
  { id: 'red', hex: '#e53935' }, { id: 'orange', hex: '#fb8c00' }, { id: 'yellow', hex: '#fdd835' }, { id: 'green', hex: '#43a047' },
  { id: 'teal', hex: '#00acc1' }, { id: 'blue', hex: '#1e88e5' }, { id: 'purple', hex: '#8e24aa' }, { id: 'pink', hex: '#d81b60' },
] as const;
/** Key of the remembered view in `localStorage` (per device, never sent to the server). */
export const VIEW_KEY = 'cal.canvasView';

export interface Point { x: number; y: number }
export interface Size { w: number; h: number }
export type Rect = Point & Size;
/** The pan (screen px of the board's top-left corner) and zoom of the board in its viewport. */
export interface View { x: number; y: number; zoom: number }
export const DEFAULT_VIEW: View = { x: 0, y: 0, zoom: 1 };

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Zoom limited to the allowed range. */
export const clampZoom = (z: number): number => clamp(z, MIN_ZOOM, MAX_ZOOM);

/** A note's top-left corner as a whole number on the board: the note stays fully inside it horizontally. */
export function clampNote(p: Point): Point {
  return { x: Math.round(clamp(p.x, 0, WORLD_W - NOTE_W)), y: Math.round(clamp(p.y, 0, WORLD_H - NOTE_ANCHOR_Y)) };
}

/** An area's rectangle as whole numbers: at least the minimum size, at most the maximum, fully on the board. */
export function clampArea(r: Rect): Rect {
  const w = Math.round(clamp(r.w, AREA_MIN_W, Math.min(AREA_MAX, WORLD_W)));
  const h = Math.round(clamp(r.h, AREA_MIN_H, Math.min(AREA_MAX, WORLD_H)));
  return { x: Math.round(clamp(r.x, 0, WORLD_W - w)), y: Math.round(clamp(r.y, 0, WORLD_H - h)), w, h };
}

/** A corner of an area (the resize handles sit on all four). */
export type Corner = 'nw' | 'ne' | 'sw' | 'se';

/**
 * The area after its `corner` handle moved by (dx, dy): the opposite corner stays where it is, the minimum and maximum size
 * and the board limit the moved edges.
 */
export function resizeRect(r: Rect, corner: Corner, dx: number, dy: number): Rect {
  const west = corner.endsWith('w'), north = corner.startsWith('n');
  const maxW = Math.min(AREA_MAX, WORLD_W), maxH = Math.min(AREA_MAX, WORLD_H);
  const right = r.x + r.w, bottom = r.y + r.h;
  const w = Math.round(clamp(west ? r.w - dx : r.w + dx, AREA_MIN_W, Math.min(maxW, west ? right : WORLD_W - r.x)));
  const h = Math.round(clamp(north ? r.h - dy : r.h + dy, AREA_MIN_H, Math.min(maxH, north ? bottom : WORLD_H - r.y)));
  return { x: west ? right - w : r.x, y: north ? bottom - h : r.y, w, h };
}

/** Where the n-th note (from 0) of the Unsorted stack lies. */
export function stackPosition(n: number): Point {
  const o = STACK_ORIGIN + STACK_STEP * Math.min(Math.max(n, 0), STACK_MAX);
  return { x: o, y: o };
}

/** What the layout needs of a task list. */
export interface NoteSource { id: string; title: string; canvas?: CanvasPlace | null }
/** A note with the position it is drawn at; `stack` is its index in the Unsorted stack (-1 once it is placed). */
export interface PlacedNote { id: string; x: number; y: number; placed: boolean; stack: number }

/**
 * Positions every note: lists with a place (or an optimistic one in `override`) where they are, the others in the
 * Unsorted stack ordered by title, then id (A-124), so a stack does not reshuffle while lists are ticked.
 */
export function placeNotes(lists: readonly NoteSource[], override: Readonly<Record<string, Point | undefined>> = {}): PlacedNote[] {
  const out: PlacedNote[] = [];
  const unsorted: NoteSource[] = [];
  for (const l of lists) {
    const p = override[l.id] ?? l.canvas ?? null;
    if (p) out.push({ id: l.id, x: p.x, y: p.y, placed: true, stack: -1 });
    else unsorted.push(l);
  }
  unsorted.sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  unsorted.forEach((l, i) => out.push({ id: l.id, ...stackPosition(i), placed: false, stack: i }));
  return out;
}

/** The anchor of a note, the point that decides which area it lies in: the middle of its top edge (A-126). */
export const noteAnchor = (p: Point): Point => ({ x: p.x + NOTE_W / 2, y: p.y + NOTE_ANCHOR_Y });

/** The topmost area (the last one in the list) that contains the note's anchor, or null. */
export function areaOf<A extends Rect>(note: Point, areas: readonly A[]): A | null {
  const a = noteAnchor(note);
  for (let i = areas.length - 1; i >= 0; i--) {
    const r = areas[i]!;
    if (a.x >= r.x && a.x < r.x + r.w && a.y >= r.y && a.y < r.y + r.h) return r;
  }
  return null;
}

/** The board position under a viewport point (screen px relative to the viewport). */
export const toWorld = (v: View, sx: number, sy: number): Point => ({ x: (sx - v.x) / v.zoom, y: (sy - v.y) / v.zoom });

/** The view with zoom `zoom` (clamped) that keeps the board point under the viewport point (fx, fy) in place. */
export function zoomAt(v: View, zoom: number, fx: number, fy: number): View {
  const z = clampZoom(zoom);
  const w = toWorld(v, fx, fy);
  return { x: fx - w.x * z, y: fy - w.y * z, zoom: z };
}

/** The view of a pinch: the board point that was under the starting midpoint follows the current midpoint. */
export function pinchView(start: View, startMid: Point, startDist: number, mid: Point, dist: number): View {
  const z = startDist > 0 ? start.zoom * (dist / startDist) : start.zoom;
  const w = toWorld(start, startMid.x, startMid.y);
  const zoom = clampZoom(z);
  return { x: mid.x - w.x * zoom, y: mid.y - w.y * zoom, zoom };
}

/** The pan limited so that {@link KEEP_VISIBLE} px of the board stay inside a viewport of vw x vh (unlimited while unmeasured). */
export function clampView(v: View, vw: number, vh: number): View {
  const zoom = clampZoom(v.zoom);
  if (vw <= 0 || vh <= 0) return { ...v, zoom };
  return {
    zoom,
    x: clamp(v.x, KEEP_VISIBLE - WORLD_W * zoom, vw - KEEP_VISIBLE),
    y: clamp(v.y, KEEP_VISIBLE - WORLD_H * zoom, vh - KEEP_VISIBLE),
  };
}

/** The remembered view from its stored text, or null when it is missing or unusable (garbage, not finite numbers). */
export function parseView(raw: string | null): View | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<View> | null;
    if (!v || ![v.x, v.y, v.zoom].every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
    return { x: v.x!, y: v.y!, zoom: clampZoom(v.zoom!) };
  } catch {
    return null;
  }
}

/** A new area of the default size centred in the view (a viewport of vw x vh), kept on the board. */
export function centeredArea(v: View, vw: number, vh: number): Rect {
  const c = toWorld(v, vw / 2, vh / 2);
  return clampArea({ x: c.x - AREA_W / 2, y: c.y - AREA_H / 2, w: AREA_W, h: AREA_H });
}

/** The palette entry for the n-th area created (they take the colours in turn). */
export const areaColor = (n: number): string => AREA_COLORS[((n % AREA_COLORS.length) + AREA_COLORS.length) % AREA_COLORS.length]!.hex;

/** The date shown on a dated note ("Wed 14 Oct"); English keeps its fixed form, the other languages follow `Intl`. */
export function noteDateLabel(date: string): string {
  const d = parseIsoDate(date);
  if (!d) return date;
  return language.value === 'en' ? format(d, 'EEE d MMM') : new Intl.DateTimeFormat(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' }).format(d);
}
