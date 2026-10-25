/**
 * Touch-screen CSS rules that the test browsers cannot show by behaviour (owner, 2026-10-25, iPhone): the page does not
 * rubber-band, a long press selects no text outside fields, and no hover state stays behind after a tap.
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

  it('touch screens: no text selection or callout outside text fields, fields selectable again', () => {
    const coarse = styles.slice(styles.indexOf('@media (pointer: coarse)'));
    expect(coarse).toMatch(/body, body :where\(\*:not\(input, textarea, select, \[contenteditable\], \[contenteditable\] \*\)\) \{\s*-webkit-user-select: none; user-select: none; -webkit-touch-callout: none;/);
    expect(coarse).toMatch(/:where\(input, textarea, select, \[contenteditable\]:not\(\[contenteditable='false'\]\)\) \{\s*-webkit-user-select: text; user-select: text;/);
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
});
