/** `pnpm widget:pictures` draws the iPhone widget for a sample day as PNGs, to look at before a phone test; skipped otherwise. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';
import { fakeScriptable, runScript, WIDGET_SOURCE } from './scriptable-fake.js';
import { widgetSvg } from './widget-picture.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = path.join(ROOT, 'widget-pictures');
const day = (h: string) => `2026-10-14T${h}:00+02:00`;
const ev = (title: string, start: string, end: string, color: string, over: object = {}) =>
  ({ id: title, title, start: day(start), end: day(end), color, allDay: false, kind: 'event', ...over });
const ITEMS = [
  { ...ev('Feiertag', '00:00', '00:00', '#7b1fa2'), allDay: true, start: '2026-10-14', end: '2026-10-15' },
  ev('Zahnarzt', '09:00', '10:00', '#d93025'),
  ev('Talk', '10:00', '11:00', '#3367d6'),
  ev('Call mit dem Team', '10:30', '12:00', '#e37400'),
  ev('Gym', '18:00', '19:00', '#188038'),
  ev('Kurz', '18:55', '19:00', '#3367d6'),
];

async function picture(family: string, language: string) {
  const answer = { generatedAt: day('08:00'), today: '2026-10-14', scriptVersion: 1, items: ITEMS, minEventMinutes: 0, weekSideBySide: false, taskCategories: false };
  const f = fakeScriptable({
    keychain: { 'calendar-widget-key': 'cwk_AAAAAAAA_' + 'B'.repeat(43), 'calendar-widget-url': 'https://cal.example.test' },
    net: () => ({ status: 200, body: JSON.stringify(answer) }), widgetFamily: family, language,
  });
  const { exports: api } = await runScript(WIDGET_SOURCE, f, { CALENDAR_WIDGET_TEST: true });
  api.now = () => Date.parse(day('11:20'));
  await api.run();
  return f.widget.set;
}

describe.skipIf(!process.env.WIDGET_PICTURES)('widget pictures', () => {
  it('writes PNGs for every size, light and dark', async () => {
    // Playwright lives in the e2e workspace; its Chromium turns the SVG into a PNG
    const { chromium } = createRequire(path.join(ROOT, 'e2e/package.json'))('@playwright/test');
    const browser = await chromium.launch();
    const page = await browser.newPage({ deviceScaleFactor: 3 });
    fs.mkdirSync(OUT, { recursive: true });
    for (const [family, language] of [['small', 'de'], ['medium', 'de'], ['large', 'de'], ['medium', 'en']] as const) {
      const widget = await picture(family, language);
      for (const dark of [false, true]) {
        const svg = widgetSvg(widget, dark);
        const name = `${family}-${language}-${dark ? 'dark' : 'light'}`;
        fs.writeFileSync(path.join(OUT, `${name}.svg`), svg);
        await page.setContent(`<body style="margin:0">${svg}</body>`);
        await page.locator('svg').screenshot({ path: path.join(OUT, `${name}.png`) });
      }
    }
    await browser.close();
    console.log(`widget pictures: ${OUT}`);
  }, 60_000);
});
