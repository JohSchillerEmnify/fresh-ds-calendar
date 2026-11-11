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
  widgetFamily?: string;
  scriptName?: string;
  /** FileManager.remove throws (the installer cannot delete itself). */
  removeFails?: boolean;
}

export interface Fakes {
  texts: { text: string; bold: boolean; where: string; relative?: boolean; rect?: { x: number; y: number; w: number; h: number } }[];
  rects: { x: number; y: number; w: number; h: number; color: string }[];
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

  class Color { constructor(public hex: string) {} static dynamic(light: Color, dark: Color) { return { light, dark }; } }
  const Font = { systemFont: (s: number) => ({ size: s, bold: false }), boldSystemFont: (s: number) => ({ size: s, bold: true }) };
  class Size { constructor(public w: number, public h: number) {} }
  class Rect { constructor(public x: number, public y: number, public w: number, public h: number) {} }
  class Node {
    url?: string; refreshAfterDate?: Date; imageSize?: Size;
    constructor(readonly where: string) {}
    addText(text: string) {
      const rec = { text, bold: false, where: this.where };
      texts.push(rec);
      return { set font(f: { bold: boolean }) { rec.bold = f.bold; } };
    }
    addDate(date: Date) {
      const rec: Fakes['texts'][number] = { text: `date:${date.toISOString()}`, bold: false, where: this.where, relative: false };
      texts.push(rec);
      return { applyRelativeStyle() { rec.relative = true; }, set font(f: { bold: boolean }) { rec.bold = f.bold; } };
    }
    addStack() { return new Node(this.where); }
    addImage() { return new Node(this.where); }
    addSpacer() { /* no-op */ }
    setPadding() { /* no-op */ }
    layoutHorizontally() { /* no-op */ }
    layoutVertically() { /* no-op */ }
    presentSmall() { widget.presented = 'small'; }
    presentMedium() { widget.presented = 'medium'; }
    presentLarge() { widget.presented = 'large'; }
    presentAccessoryRectangular() { widget.presented = 'accessoryRectangular'; }
  }
  class ListWidget extends Node { constructor() { super('widget'); } }
  class DrawContext {
    size?: Size; private bold = false;
    setFont(f: { bold: boolean }) { this.bold = f.bold; }
    setTextColor() { /* no-op */ }
    private fill = '';
    setFillColor(c: Color | { light: Color }) { this.fill = 'hex' in c ? c.hex : 'dynamic'; }
    fillRect(r: Rect) { rects.push({ x: r.x, y: r.y, w: r.w, h: r.h, color: this.fill }); }
    drawTextInRect(text: string, r: Rect) { texts.push({ text, bold: this.bold, where: 'canvas', rect: { x: r.x, y: r.y, w: r.w, h: r.h } }); }
    getImage() { return {}; }
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
    Device: { language: () => o.language ?? 'en' },
    Script: { name: () => o.scriptName ?? 'Calendar', setWidget: (w: unknown) => { widget.set = w; }, complete: () => { widget.completed = true; } },
    config: { runsInWidget: o.runsInWidget ?? true, widgetFamily: o.widgetFamily ?? 'medium' },
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
