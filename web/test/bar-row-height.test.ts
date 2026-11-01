/** The bar grows by the open tasks row: `--bar-extra` must equal the row's real height plus the padding the bar's slot puts above it. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const src = join(__dirname, '../src');
const tray = readFileSync(join(src, 'features/tasklists/TaskTray.vue'), 'utf8');
const bar = readFileSync(join(src, 'components/m3/NavigationBar.vue'), 'utf8');

it('ROW_PX is the row2 height plus the slot padding', () => {
  const row = Number(/\.bar\.row2 \{[^}]*\bheight: (\d+)px/.exec(tray)![1]);
  const pad = Number(/\.extra \{[^}]*padding-top: (\d+)px/.exec(bar)![1]);
  const px = Number(/const ROW_PX = (\d+)/.exec(tray)![1]);
  expect(px).toBe(row + pad);
});
