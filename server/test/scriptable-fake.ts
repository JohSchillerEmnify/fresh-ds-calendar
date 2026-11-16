/* eslint-disable @typescript-eslint/no-explicit-any -- the script and the API answers are untyped JavaScript objects */
/** A stand-in for the Scriptable app's API (docs.scriptable.app): enough to run the widget script and the installer on Node and see what they draw. */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildWidgetScript } from '../src/services/widgetScript.js';

export const WIDGET_SOURCE = buildWidgetScript(fs.readFileSync(fileURLToPath(new URL('../../ios/widget/calendar-widget.js', import.meta.url)), 'utf8'));

export type Net = (url: string, headers: Record<string, string>) => { status: number; body: string };

export interface Options {
  net?: Net;
  language?: string;
  icloud?: boolean;
  files?: Record<string, string>;
  keychain?: Record<string, string>;
  runsInWidget?: boolean;
  /** null = run inside the app (no family). */
  widgetFamily?: string | null;
  /** Device.screenSize() in points. */
  screen?: [number, number];
  scriptName?: string;
  /** FileManager.remove throws (the installer cannot delete itself). */
  removeFails?: boolean;
}

export interface El { kind: 'stack' | 'text' | 'date' | 'image' | 'spacer' }
export interface Img { kind: 'picture'; size: { width: number; height: number }; rects: { x: number; y: number; w: number; h: number; color: string; alpha: number }[] }

export interface Fakes {
  texts: { text: string; bold: boolean; size?: number; color?: unknown; where: string; relative?: boolean; rect?: { x: number; y: number; w: number; h: number } }[];
  rects: { x: number; y: number; w: number; h: number; color: string; alpha: number }[];
  alerts: { title: string; message: string }[];
  files: Map<string, string>;
  keychain: Map<string, string>;
  requests: { url: string; headers: Record<string, string> }[];
  widget: { set: any; presented: string | null; completed: boolean };
  globals: Record<string, unknown>;
}

export function fakeScriptable(o: Options = {}): Fakes {
  const files = new Map(Object.entries(o.files ?? {}));
  const keychain = new Map(Object.entries(o.keychain ?? {}));
  const texts: Fakes['texts'] = [];
  const alerts: Fakes['alerts'] = [];
  const rects: Fakes['rects'] = [];
  const requests: Fakes['requests'] = [];
  const widget: Fakes['widget'] = { set: null, presented: null, completed: false };

  class Color {
    constructor(public hex: string, public alpha = 1) {}
    static dynamic(light: Color, dark: Color) { return new DynamicColor(light, dark); }
  }
  class DynamicColor { constructor(public light: Color, public dark: Color) {} }
  const Font = { systemFont: (s: number) => ({ size: s, bold: false }), boldSystemFont: (s: number) => ({ size: s, bold: true }) };
  class Size { constructor(public width: number, public height: number) {} }
  class Rect { constructor(public x: number, public y: number, public width: number, public height: number) {} }
  /** A widget, stack, text, date, image or spacer: the tree the script builds (positions are worked out by `layoutOf`). */
  class Node {
    kind: El['kind']; parent?: Node; kids: Node[] = [];
    url?: string; refreshAfterDate?: Date; imageSize?: Size; size?: Size; length?: number | null;
    backgroundColor?: unknown; backgroundImage?: Img; cornerRadius?: number; horizontal = false;
    text?: string;
    constructor(readonly where: string, kind: El['kind'] = 'stack') { this.kind = kind; }
    private add(n: Node) { n.parent = this; this.kids.push(n); return n; }
    addText(text: string) {
      const n = this.add(new Node(this.where, 'text'));
      n.text = text;
      const rec: Fakes['texts'][number] = { text, bold: false, where: this.where };
      texts.push(rec);
      Object.defineProperty(n, 'font', { get: () => rec, set: (f: { bold: boolean; size: number }) => { rec.bold = f.bold; rec.size = f.size; } });
      Object.defineProperty(n, 'textColor', { get: () => rec.color, set: (c: unknown) => { rec.color = c; } });
      return n;
    }
    addDate(date: Date) {
      const n = this.add(new Node(this.where, 'date'));
      const rec: Fakes['texts'][number] = { text: `date:${date.toISOString()}`, bold: false, where: this.where, relative: false };
      texts.push(rec);
      return Object.assign(n, { applyRelativeStyle() { rec.relative = true; } });
    }
    addStack() { return this.add(new Node(this.where)); }
    addImage() { return this.add(new Node(this.where, 'image')); }
    addSpacer(length: number | null = null) { const n = this.add(new Node(this.where, 'spacer')); n.length = length; return n; }
    setPadding() { /* no-op */ }
    topAlignContent() { /* no-op */ }
    centerAlignContent() { /* no-op */ }
    layoutHorizontally() { this.horizontal = true; }
    layoutVertically() { this.horizontal = false; }
    presentSmall() { widget.presented = 'small'; }
    presentMedium() { widget.presented = 'medium'; }
    presentLarge() { widget.presented = 'large'; }
    presentAccessoryRectangular() { widget.presented = 'accessoryRectangular'; }
  }
  class ListWidget extends Node { constructor() { super('widget'); } }
  /** DrawContext keeps no dynamic colours (docs.scriptable.app/color): using one is an error here, as it draws wrongly on a phone. */
  const plain = (c: Color | DynamicColor): Color => {
    if (c instanceof DynamicColor) throw new Error('Color.dynamic is not supported in a DrawContext');
    return c;
  };
  class DrawContext {
    size?: Size; respectScreenScale?: boolean; opaque?: boolean; private bold = false; private fontSize = 0;
    private fill = new Color('');
    private drawn: Fakes['rects'] = [];
    setFont(f: { bold: boolean; size: number }) { this.bold = f.bold; this.fontSize = f.size; }
    setTextColor(c: Color) { plain(c); }
    setFillColor(c: Color | DynamicColor) { this.fill = plain(c); }
    fillRect(r: Rect) {
      const rec = { x: r.x, y: r.y, w: r.width, h: r.height, color: this.fill.hex, alpha: this.fill.alpha };
      rects.push(rec);
      this.drawn.push(rec);
    }
    drawTextInRect(text: string, r: Rect) { texts.push({ text, bold: this.bold, size: this.fontSize, where: 'canvas', rect: { x: r.x, y: r.y, w: r.width, h: r.height } }); }
    getImage(): Img { return { kind: 'picture', size: this.size!, rects: this.drawn }; }
  }
  class Request {
    headers: Record<string, string> = {};
    response: { statusCode: number } | null = null;
    constructor(readonly url: string) {}
    async loadString() {
      requests.push({ url: this.url, headers: this.headers });
      if (!o.net) throw new Error('The Internet connection appears to be offline.');
      const r = o.net(this.url, this.headers);
      this.response = { statusCode: r.status };
      return r.body;
    }
  }
  const dir = (d: string) => () => `/${d}`;
  const manager = {
    documentsDirectory: dir('docs'), libraryDirectory: dir('lib'),
    joinPath: (a: string, b: string) => `${a}/${b}`,
    fileExists: (p: string) => files.has(p), readString: (p: string) => files.get(p)!, writeString: (p: string, s: string) => { files.set(p, s); },
    remove: (p: string) => { if (o.removeFails) throw new Error('cannot remove'); files.delete(p); },
  };
  class Alert {
    title = ''; message = '';
    addAction() { /* no-op */ }
    async presentAlert() { alerts.push({ title: this.title, message: this.message }); return 0; }
  }
  const globals = {
    Color, Font, Size, Rect, ListWidget, DrawContext, Request, Alert,
    Point: class { constructor(public x: number, public y: number) {} },
    FileManager: { local: () => manager, iCloud: () => { if (o.icloud === false) throw new Error('iCloud is off'); return manager; } },
    Keychain: { contains: (k: string) => keychain.has(k), get: (k: string) => keychain.get(k), set: (k: string, v: string) => { keychain.set(k, v); } },
    Device: { language: () => o.language ?? 'en', screenSize: () => new Size(...(o.screen ?? [390, 844])) },
    Script: { name: () => o.scriptName ?? 'Calendar', setWidget: (w: unknown) => { widget.set = w; }, complete: () => { widget.completed = true; } },
    config: { runsInWidget: o.runsInWidget ?? o.widgetFamily !== null, widgetFamily: o.widgetFamily === undefined ? 'medium' : o.widgetFamily },
  };
  return { texts, rects, alerts, files, keychain, requests, widget, globals };
}

const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor as new (...a: string[]) => (...v: unknown[]) => Promise<unknown>;

/** Runs a Scriptable script text with the fakes as its globals; `extra` adds more globals (e.g. the test switch). */
export async function runScript(source: string, f: Fakes, extra: Record<string, unknown> = {}): Promise<{ exports: any }> {
  const module = { exports: {} as any, filename: '/docs/Untitled Script.js' };
  const all = { ...f.globals, ...extra, module };
  await new AsyncFunction(...Object.keys(all), source)(...Object.values(all));
  return module;
}

export interface Box { node: LNode; x: number; y: number; w: number; h: number }
type LNode = { kind: El['kind']; kids: LNode[]; parent?: LNode; size?: { width: number; height: number }; length?: number | null; horizontal: boolean };

/** Where every element of a widget lands, from sizes, spacers and stack directions (a text and an image without a size count as 0 long). */
export function layoutOf(root: unknown): Map<unknown, Box> {
  const out = new Map<unknown, Box>();
  const own = (n: LNode) => ({ w: n.size && n.size.width > 0 ? n.size.width : 0, h: n.size && n.size.height > 0 ? n.size.height : 0 });
  const measure = (n: LNode): { w: number; h: number } => {
    const o = own(n);
    if (n.kind === 'spacer') return { w: n.length ?? 0, h: n.length ?? 0 };
    if (n.kind !== 'stack') return o;
    const m = n.kids.map(measure);
    const main = (v: { w: number; h: number }) => (n.horizontal ? v.w : v.h);
    const cross = (v: { w: number; h: number }) => (n.horizontal ? v.h : v.w);
    const sum = m.reduce((a, v) => a + main(v), 0);
    const mx = Math.max(0, ...m.map(cross));
    const auto = n.horizontal ? { w: sum, h: mx } : { w: mx, h: sum };
    return { w: o.w || auto.w, h: o.h || auto.h };
  };
  const place = (n: LNode, x: number, y: number) => {
    const m = measure(n);
    out.set(n, { node: n, x, y, w: m.w, h: m.h });
    let at = 0;
    for (const k of n.kids) {
      const km = measure(k);
      if (k.kind === 'spacer') { at += n.horizontal ? km.w : km.h; continue; }
      place(k, n.horizontal ? x + at : x, n.horizontal ? y : y + at);
      at += n.horizontal ? km.w : km.h;
    }
  };
  place(root as LNode, 0, 0);
  return out;
}
