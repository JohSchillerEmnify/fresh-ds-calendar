/**
 * Touch-screen CSS rules that the test browsers cannot show by behaviour (owner, 2026-10-25, iPhone): the page does not
 * rubber-band, nothing is selectable outside fields and an event's description, place and notes, and no hover state stays behind after a tap.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = join(__dirname, '../src');
const styles = readFileSync(join(src, 'styles.css'), 'utf8');

/** Every .vue and .css file under `dir`. */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(vue|css)$/.test(n) ? [p] : [];
  });
}

describe('touch CSS', () => {
  it('the page itself never rubber-bands: overscroll-behavior on html (WebKit ignores it on body)', () => {
    expect(styles).toMatch(/^html \{ overscroll-behavior: none; \}/m);
  });

  it('nothing is selectable or gets a long-press callout on any pointer; fields and event description, place and notes are (owner, 2026-11-12)', () => {
    const kept = "input, textarea, select, [contenteditable], [contenteditable] *, [data-selectable], [data-selectable] *";
    expect(styles).not.toMatch(/@media \(pointer: coarse\) \{\s*body, body :where/);
    expect(styles).toContain(`body, body :where(*:not(${kept})) {\n  -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;`);
    expect(styles).toMatch(/:where\(input, textarea, select, \[contenteditable\]:not\(\[contenteditable='false'\]\), \[data-selectable\], \[data-selectable\] \*\) \{\s*-webkit-user-select: text; user-select: text; -webkit-touch-callout: default;/);
    expect(styles).not.toContain("section.page");
  });

  it('every :hover rule outside the labs only applies to a real pointer (@media (hover: hover) on the same line)', () => {
    const bad: string[] = [];
    for (const f of files(src)) {
      const rel = relative(src, f);
      if (rel.startsWith('features/labs') || rel.startsWith('features/motivation/MotionLab')) continue;
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (/:hover\b/.test(line) && !line.includes('@media (hover: hover)') && !line.trim().startsWith('/*') && !line.trim().startsWith('*')) bad.push(`${rel}:${i + 1}`);
      });
    }
    expect(bad).toEqual([]);
  });

  it('a pressed control squishes slightly and never turns square: the radius change is animated and stays medium or rounder', () => {
    const bad: string[] = [];
    for (const f of files(src)) {
      const text = readFileSync(f, 'utf8');
      text.split('\n').forEach((line, i) => {
        const m = /^(\S+?):active[^{]*\{[^}]*border-radius:\s*([^;}]+)/.exec(line.trim());
        if (!m) return;
        // a base radius of 9999px makes the animation snap at its very end, which reads as a flash
        const base = new RegExp(`^\\${m[1]} \\{[^\\n]*border-radius: var\\(--md-sys-shape-corner-full\\)`, 'm').test(text) || new RegExp(`^\\${m[1]} \\{\\s*$[^}]*border-radius: var\\(--md-sys-shape-corner-full\\)`, 'm').test(text);
        if (base) { bad.push(`${relative(src, f)}:${i + 1} (base radius is full)`); return; }
        const rounded = /shape-corner-(medium|large|extra-large|full)\)$/.test(m[2].trim());
        const animated = /transition:[^;]*border-radius/.test(text);
        if (!rounded || !animated) bad.push(`${relative(src, f)}:${i + 1}`);
      });
    }
    expect(bad).toEqual([]);
  });
});
