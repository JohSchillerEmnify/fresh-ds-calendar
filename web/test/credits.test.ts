import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Dependency } from 'rollup-plugin-license';
import { toCredits, webUrl } from '../credits-plugin';
import { EXTRA_CREDITS } from '@/credits/extra';
import { mergeCredits } from '@/credits/types';

describe('mergeCredits', () => {
  it('an extra credit is merged into the generated list and sorted by name', () => {
    const merged = mergeCredits([{ name: 'vue', license: 'MIT' }, { name: 'date-fns', license: 'MIT' }], [{ name: 'Solar Bold Duotone', author: '480 Design', license: 'CC BY 4.0' }]);
    expect(merged.map((c) => c.name)).toEqual(['date-fns', 'Solar Bold Duotone', 'vue']);
  });

  it('a package that is both generated and extra is listed once, the generated one wins', () => {
    const merged = mergeCredits([{ name: 'Vue', license: 'MIT' }], [{ name: 'vue', license: 'other' }]);
    expect(merged).toEqual([{ name: 'Vue', license: 'MIT' }]);
  });
});

describe('toCredits', () => {
  const dep = (o: object) => ({ name: 'a', license: 'MIT', ...o }) as unknown as Dependency;

  it('keeps name, author, licence and a browsable link, once per package', () => {
    const out = toCredits([dep({ name: 'b', author: { name: 'Ann' }, repository: { url: 'git+https://github.com/x/b.git' } }), dep({ name: 'b' }), dep({ name: 'a', homepage: 'https://a.example' })]);
    expect(out).toEqual([{ name: 'a', license: 'MIT', url: 'https://a.example' }, { name: 'b', author: 'Ann', license: 'MIT', url: 'https://github.com/x/b' }]);
  });

  it('turns repository shorthands into https links and drops what is no link', () => {
    expect(webUrl('git://github.com/x/y.git')).toBe('https://github.com/x/y');
    expect(webUrl('github:x/y')).toBe('https://github.com/x/y');
    expect(webUrl('ssh://git@host/x')).toBeUndefined();
  });
});

describe('Android credits', () => {
  it('every Gradle dependency of the app shell is credited in extra.ts', () => {
    const gradle = readFileSync(join(__dirname, '../../android/app/build.gradle'), 'utf8');
    const libs = [...gradle.matchAll(/^\s*implementation ["']([\w.]+):([\w-]+)/gm)].map((m) => `${m[1]}:${m[2]}`);
    const known = ['androidx.appcompat:appcompat', 'androidx.coordinatorlayout:coordinatorlayout', 'androidx.core:core-splashscreen', 'androidx.work:work-runtime', 'androidx.browser:browser'];
    expect(libs.sort()).toEqual(known.sort());
    expect(EXTRA_CREDITS.filter((c) => c.name.startsWith('AndroidX'))).toHaveLength(known.length);
  });
});
