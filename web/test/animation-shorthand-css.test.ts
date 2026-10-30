/**
 * A CSS rule the unit tests cannot see by behaviour (owner, 2026-10-26: the scene visitors stayed in the top left
 * corner): the build's CSS minifier (lightningcss) rewrites an `animation` shorthand without a keyframe name, such as
 * `animation: 10s ease-in-out both`, to `animation: none`, dropping its duration. A name set by another rule then runs
 * for 0 s. Such rules write the longhands instead.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = join(__dirname, '../src');

/** Every .vue and .css file under `dir`. */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(vue|css)$/.test(n) ? [p] : [];
  });
}

/** The words of an animation shorthand that are not its name: keywords, times, counts and timing functions (a `var()` may be the name; the minifier keeps such a declaration as written). */
const NOT_A_NAME = /^(?:\d*\.?\d+m?s|\d*\.?\d+|infinite|normal|reverse|alternate(?:-reverse)?|none|forwards|backwards|both|running|paused|linear|ease(?:-in|-out|-in-out)?|step-start|step-end|(?:steps|cubic-bezier|linear)\(.*\))$/;

describe('animation shorthand CSS', () => {
  it('no animation shorthand has a duration but no keyframe name (the minifier makes it `animation: none`)', () => {
    const bad: string[] = [];
    for (const f of files(src)) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        for (const m of line.matchAll(/(?:^|[\s;{])animation:\s*([^;}]+)/g)) {
          // each comma-separated animation on its own (commas inside functions do not split)
          for (const one of m[1].trim().replace(/\s*!important$/, '').split(/,(?![^(]*\))/)) {
            const words = one.trim().split(/\s+(?![^(]*\))/);
            const timed = words.some((w) => /^\d*\.?\d+m?s$/.test(w));
            if (timed && words.every((w) => NOT_A_NAME.test(w))) bad.push(`${relative(src, f)}:${i + 1}`);
          }
        }
      });
    }
    expect(bad).toEqual([]);
  });
});
