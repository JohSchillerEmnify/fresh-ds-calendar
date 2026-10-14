// Renders the app logo (web/public/icons/logo*.svg) to every PNG the app ships: PWA icons, favicon fallback, apple-touch,
// Android launcher mipmaps and the Google consent-screen logo. Run: pnpm --filter web icons
// Needs a Chromium binary: $CHROME, or Playwright's cache (~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const here = path.dirname(new URL(import.meta.url).pathname);
const icons = path.resolve(here, '../public/icons');
const root = path.resolve(here, '../..');
const res = path.join(root, 'android/app/src/main/res');
const branding = path.join(root, 'docs/branding');
const svg = (n) => fs.readFileSync(path.join(icons, n), 'utf8');

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const cache = path.join(os.homedir(), '.cache/ms-playwright');
  const dir = fs.existsSync(cache) ? fs.readdirSync(cache).filter((d) => d.startsWith('chromium-')).sort().pop() : undefined;
  if (!dir) throw new Error('no Chromium found: set CHROME=/path/to/chrome');
  return path.join(cache, dir, 'chrome-linux64/chrome');
}
const chrome = findChrome();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-icons-'));

/** Screenshots `body` (HTML) at size x size with a transparent page background into `file`. */
function shot(file, size, body) {
  const html = path.join(tmp, 'p.html');
  fs.writeFileSync(html, `<!doctype html><body style="margin:0;background:transparent;overflow:hidden">${body}</body>`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const r = spawnSync(chrome, ['--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
    `--window-size=${size},${size}`, `--screenshot=${file}`, `file://${html}`], { stdio: 'ignore' });
  if (r.status !== 0 || !fs.existsSync(file)) throw new Error(`render failed: ${file}`);
}
const img = (src, size, extra = '') => `<img src="${src}" width="${size}" height="${size}" style="display:block;${extra}">`;
const uri = (name) => `data:image/svg+xml;base64,${Buffer.from(svg(name)).toString('base64')}`;
const asSvg = (s) => `data:image/svg+xml;base64,${Buffer.from(s).toString('base64')}`;

// adaptive-icon foreground: maskable art without the background, shrunk into the 66/108 safe zone
const foreground = svg('logo-maskable.svg').replace(/<rect id="bg"[^>]*\/>\n?/, '').replace('scale(.8)', 'scale(.62)');

// PWA, favicon, apple-touch
shot(path.join(icons, 'icon-192.png'), 192, img(uri('logo.svg'), 192));
shot(path.join(icons, 'icon-512.png'), 512, img(uri('logo.svg'), 512));
shot(path.join(icons, 'icon-maskable-512.png'), 512, img(uri('logo-maskable.svg'), 512));
shot(path.join(icons, 'apple-touch-icon-180.png'), 180, `<div style="width:180px;height:180px;background:#1a73e8;overflow:hidden">${img(uri('logo.svg'), 214, 'margin:-17px')}</div>`);
shot(path.join(icons, 'favicon-32.png'), 32, img(uri('logo-small.svg'), 32));

// Android mipmaps (legacy square, round, adaptive foreground)
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(dens)) {
  const dir = path.join(res, `mipmap-${d}`), l = 48 * k, f = 108 * k;
  shot(path.join(dir, 'ic_launcher.png'), l, img(uri(l >= 96 ? 'logo.svg' : 'logo-small.svg'), l));
  shot(path.join(dir, 'ic_launcher_round.png'), l, `<div style="width:${l}px;height:${l}px;border-radius:50%;overflow:hidden">${img(uri('logo-maskable.svg'), l)}</div>`);
  shot(path.join(dir, 'ic_launcher_foreground.png'), f, img(asSvg(foreground), f));
}

// Google Cloud OAuth consent screen (120x120 is Google's recommended size)
fs.mkdirSync(branding, { recursive: true });
fs.copyFileSync(path.join(icons, 'logo.svg'), path.join(branding, 'logo.svg'));
shot(path.join(branding, 'logo-120.png'), 120, img(uri('logo.svg'), 120));

fs.rmSync(tmp, { recursive: true, force: true });
console.log('icons written');
