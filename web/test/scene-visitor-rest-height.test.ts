/**
 * The bat's resting height must be a fraction of the part of the 96 px scene layer the bar shows (`--d` is what it clips
 * on top): a bare `14cqh` put the resting bat above the visible bar, so a bat on its fly-rest flight (40 % of the visits)
 * was out of sight.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('the bat rests in the part of the layer the bar shows', () => {
  const css = readFileSync(join(__dirname, '../src/features/motivation/SceneLife.vue'), 'utf8');
  const rule = /\.flutter\.bat\s*\{[^}]*--rest-y:\s*([^;]+);/.exec(css)?.[1] ?? '';
  expect(rule).toContain('var(--d');
});
