import { chromium } from '/work/e2e/node_modules/@playwright/test/index.mjs';
const b = await chromium.launch();
for (const [name, w, h, scheme] of [['m375d',375,740,'dark'],['m375l',375,740,'light'],['d1280',1280,800,'light'],['m375dd',375,740,'dark']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  for (const v of ['month/2026-10-12','week/2026-10-12','day/2026-10-12']) {
    await p.goto(`http://localhost:3917/${v}`); await p.waitForTimeout(1500);
    await p.screenshot({ path: `/shots/${name}-${v.split('/')[0]}.png` });
  }
  await ctx.close();
}
await b.close();
