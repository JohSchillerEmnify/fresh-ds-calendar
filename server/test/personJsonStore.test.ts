import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CanvasStore } from '../src/services/canvasStore.js';
import { PrefsStore } from '../src/services/prefsStore.js';
import { TemplateStore } from '../src/services/templateStore.js';
import { ThemeStore } from '../src/services/themeStore.js';
import { isRecord, PersonJsonStore } from '../src/lib/personJsonStore.js';

let dir: string;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pjs-')); });
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const userFile = (...p: string[]) => path.join(dir, 'users', 'alice', ...p);
const put = (rel: string, text: string) => { fs.mkdirSync(path.dirname(userFile(rel)), { recursive: true }); fs.writeFileSync(userFile(rel), text); };
const asides = (prefix: string, sub = '.') => fs.readdirSync(path.dirname(userFile(sub, 'x'))).filter((f) => f.startsWith(`${prefix}.corrupt-`) && f.endsWith('.json'));

describe('PersonJsonStore', () => {
  const make = (log: (m: string) => void = () => undefined) =>
    new PersonJsonStore<{ n: number }>(dir, 'doc.json', (r) => (isRecord(r) && typeof r.n === 'number' ? { n: r.n } : null), () => ({ n: 0 }), log);

  it('returns the empty document when there is no file and writes atomically', () => {
    const s = make();
    expect(s.read('alice')).toEqual({ n: 0 });
    s.write('alice', { n: 3 });
    expect(s.read('alice')).toEqual({ n: 3 });
  });

  it('moves a file that is not JSON aside as <name>.corrupt-<timestamp>.json, logs it and keeps its bytes', () => {
    const lines: string[] = [];
    const s = make((m) => lines.push(m));
    put('doc.json', '{ not json');
    expect(s.read('alice')).toEqual({ n: 0 });
    const aside = asides('doc');
    expect(aside).toHaveLength(1);
    expect(fs.readFileSync(userFile(aside[0]!), 'utf8')).toBe('{ not json');
    expect(fs.existsSync(userFile('doc.json'))).toBe(false);
    expect(lines).toHaveLength(1);
    s.write('alice', { n: 1 });
    expect(fs.readFileSync(userFile(aside[0]!), 'utf8')).toBe('{ not json');
  });

  it('moves a file aside when the parse hook rejects its shape', () => {
    const s = make();
    put('doc.json', '{"n":"x"}');
    expect(s.read('alice')).toEqual({ n: 0 });
    expect(asides('doc')).toHaveLength(1);
  });
});

describe('a damaged file is kept aside by every per-person store', () => {
  it('canvas: keeps the file and does not overwrite it on the next put', () => {
    const s = new CanvasStore(dir);
    put('canvas.json', '[broken');
    expect(s.get('alice')).toEqual({ version: 1, areas: [] });
    s.put('alice', []);
    const aside = asides('canvas');
    expect(aside).toHaveLength(1);
    expect(fs.readFileSync(userFile(aside[0]!), 'utf8')).toBe('[broken');
  });

  it('prefs: keeps the file, returns defaults and does not lose it on the next write', () => {
    const s = new PrefsStore(dir);
    put('prefs.json', '{"labs": tru');
    expect(s.labsPrefs('alice').labs).toBe(false);
    s.setHidden('alice', 'c1', true);
    expect(s.hiddenCalendars('alice')).toEqual(['c1']);
    const aside = asides('prefs');
    expect(aside).toHaveLength(1);
    expect(fs.readFileSync(userFile(aside[0]!), 'utf8')).toBe('{"labs": tru');
  });

  it('prefs: a file holding an array is damaged, an empty object is fine', () => {
    const s = new PrefsStore(dir);
    put('prefs.json', '{}');
    s.labsPrefs('alice');
    expect(asides('prefs')).toHaveLength(0);
    put('prefs.json', '[1]');
    s.labsPrefs('alice');
    expect(asides('prefs')).toHaveLength(1);
  });

  it('reminder overrides: keeps the file and starts empty', () => {
    const s = new PrefsStore(dir).reminderOverrides;
    put('reminder-overrides.json', 'nope');
    expect(s.all('alice')).toEqual({});
    s.set('alice', 'cal', 'ev', [] as never);
    const aside = asides('reminder-overrides');
    expect(aside).toHaveLength(1);
    expect(fs.readFileSync(userFile(aside[0]!), 'utf8')).toBe('nope');
  });

  it('templates: keeps the file aside as templates.corrupt-<timestamp>.json', () => {
    const s = new TemplateStore(dir, () => undefined);
    put('templates.json', '{ not json');
    expect(s.list('alice')).toEqual([]);
    expect(asides('templates')).toHaveLength(1);
  });

  it('themes: sets a damaged theme file aside, keeps the good ones and does not list the copy', () => {
    const s = new ThemeStore(dir);
    put('themes/good.json', JSON.stringify({ id: 'good', created: 1, doc: { name: 'x' } }));
    put('themes/bad.json', '{ nope');
    expect(s.list('alice').map((t) => t.id)).toEqual(['good']);
    expect(asides('bad', 'themes')).toHaveLength(1);
    expect(s.list('alice').map((t) => t.id)).toEqual(['good']);
    expect(asides('bad', 'themes')).toHaveLength(1);
  });
});
